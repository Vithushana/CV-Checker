# pyapi/main.py
import os, re, time, shutil
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv

import fitz               # PyMuPDF
import docx               # python-docx
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm

import smtplib
from email.message import EmailMessage

load_dotenv()

PORT = int(os.getenv("PORT", "8000"))

# ---------- paths ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(REPORTS_DIR, exist_ok=True)

# ---------- app ----------
app = FastAPI(title="CV Checker API (Python)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# serve reports like /reports/<id>.pdf
app.mount("/reports", StaticFiles(directory=REPORTS_DIR), name="reports")

# ---------- utils ----------
def extract_text(path: str) -> str:
    p = path.lower()
    if p.endswith(".pdf"):
        out = []
        with fitz.open(path) as doc:
            for page in doc:
                out.append(page.get_text())
        return "\n".join(out)
    if p.endswith(".docx"):
        d = docx.Document(path)
        return "\n".join(par.text for par in d.paragraphs)
    return ""

_word = re.compile(r"[a-zA-Z][a-zA-Z0-9+\-#\.]{1,}")
def tokens(s: str) -> set[str]:
    return set(_word.findall(s.lower()))

def years_from_text(s: str) -> int:
    yrs = re.findall(r"(\d+)\+?\s*(?:years|yrs)", s.lower())
    return max([int(x) for x in yrs], default=0)

def score_cv(cv_path: str, jd_text: str) -> dict:
    cv_text = extract_text(cv_path)
    cvt, jdt = tokens(cv_text), tokens(jd_text)

    # skills overlap (soft-curve)
    inter = len(cvt & jdt)
    s_skills = (inter / max(1, len(jdt))) ** 0.5

    # experience match
    cv_years = years_from_text(cv_text)
    jd_years = years_from_text(jd_text)
    s_exp = 1.0 if jd_years == 0 else min(1.0, cv_years / max(1, jd_years))

    # education heuristic
    edu = 1.0 if re.search(r"(bachelor|master|phd)", cv_text.lower()) and re.search(r"(bachelor|master|phd)", jd_text.lower()) else 0.6

    # extras / tech keywords
    tech = ["react","node","aws","docker","typescript","graphql","vite","redux","jest","cypress"]
    extras = 1.0 if any(t in cv_text.lower() for t in tech) and any(t in jd_text.lower() for t in tech) else 0.5

    final = round((s_skills*0.55 + s_exp*0.25 + edu*0.10 + extras*0.10) * 100)

    missing = list((jdt - cvt))[:10]
    suggestions = []
    if missing: suggestions.append("Add missing keywords: " + ", ".join(missing))
    if cv_years < jd_years: suggestions.append(f"Clearly highlight experience: JD asks ~{jd_years} yrs, CV shows {cv_years}.")
    if "summary" not in cv_text.lower(): suggestions.append("Add a 2–3 line Professional Summary at the top.")
    if len(cv_text.split()) > 900: suggestions.append("Keep CV to ~1–2 pages; tighten bullets.")
    if not suggestions:
        suggestions = ["Looks good—tailor bullets with measurable impact."]

    return {
        "score": final,
        "breakdown": {
            "skills": round(s_skills*100),
            "experience": round(s_exp*100),
            "education": round(edu*100),
            "extras": round(extras*100),
        },
        "suggestions": suggestions,
    }

def make_pdf(report_id: str, score: int, breakdown: dict, suggestions: list[str]) -> str:
    path = os.path.join(REPORTS_DIR, f"{report_id}.pdf")
    c = canvas.Canvas(path, pagesize=A4)
    w, h = A4
    x, y = 2.0*cm, h - 2.0*cm

    c.setFont("Helvetica-Bold", 18)
    c.drawString(x, y, "CV ↔ JD Match Report")
    y -= 1.0*cm

    c.setFont("Helvetica", 11)
    c.drawString(x, y, f"Report ID: {report_id}")
    y -= 0.6*cm
    c.drawString(x, y, f"Generated: {datetime.utcnow().isoformat()}Z")
    y -= 1.0*cm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, f"Overall Score: {score}%")
    y -= 0.8*cm

    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, "Breakdown:")
    y -= 0.6*cm
    c.setFont("Helvetica", 11)
    for k in ["skills","experience","education","extras"]:
        c.drawString(x+0.5*cm, y, f"- {k.capitalize()}: {breakdown.get(k,0)}%")
        y -= 0.5*cm

    y -= 0.5*cm
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, "Top Suggestions:")
    y -= 0.6*cm
    c.setFont("Helvetica", 11)
    if suggestions:
        for s in suggestions[:10]:
            for line in _wrap(s, 90):
                c.drawString(x+0.5*cm, y, f"- {line}")
                y -= 0.5*cm
                if y < 2*cm:
                    c.showPage(); y = h - 2.0*cm; c.setFont("Helvetica", 11)
    else:
        c.drawString(x+0.5*cm, y, "- None")

    c.showPage()
    c.save()
    # return URL path (FastAPI serves /reports)
    return f"/reports/{report_id}.pdf"

def _wrap(text: str, width: int) -> list[str]:
    words = text.split()
    lines, cur = [], []
    n = 0
    for w in words:
        if n + len(w) + (1 if cur else 0) > width:
            lines.append(" ".join(cur)); cur=[w]; n=len(w)
        else:
            cur.append(w); n += len(w) + (1 if cur[:-1] else 0)
    if cur: lines.append(" ".join(cur))
    return lines

def send_email(to_addr: str, pdf_disk_path: str, score: int):
    host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER", "")
    pwd  = os.getenv("SMTP_PASS", "")
    frm_name = os.getenv("FROM_NAME", "CV Checker")
    frm_email = os.getenv("FROM_EMAIL", user or "no-reply@cvchecker.local")

    if not to_addr or not user or not pwd:
        raise RuntimeError("SMTP credentials missing")

    msg = EmailMessage()
    msg["Subject"] = f"Your Job Match Report – {score}%"
    msg["From"] = f"{frm_name} <{frm_email}>"
    msg["To"] = to_addr
    msg.set_content(f"Hello!\nYour CV ↔ JD match report is attached.\nScore: {score}%")

    with open(pdf_disk_path, "rb") as f:
        data = f.read()
    msg.add_attachment(data, maintype="application", subtype="pdf", filename="report.pdf")

    with smtplib.SMTP(host, port) as s:
        s.starttls()
        s.login(user, pwd)
        s.send_message(msg)

# ---------- routes ----------
@app.get("/api/health")
def health():
    return {"ok": True}

@app.post("/api/analyze")
async def analyze(
    cv: UploadFile = File(...),
    jdText: str = Form(...),
    email: Optional[str] = Form(None),
    sendEmail: Optional[str] = Form(None),
):
    # validate file type
    if cv.content_type not in (
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        raise HTTPException(status_code=400, detail="Only PDF or DOCX allowed")

    # save upload temporarily
    ts = str(int(time.time() * 1000))
    ext = ".pdf" if cv.filename.lower().endswith(".pdf") else ".docx"
    saved_path = os.path.join(UPLOADS_DIR, f"{ts}{ext}")
    with open(saved_path, "wb") as out:
        shutil.copyfileobj(cv.file, out)

    try:
        # scoring (local, pure Python)
        result = score_cv(saved_path, jdText)

        # pdf report
        report_id = ts
        pdf_url_path = make_pdf(report_id, result["score"], result["breakdown"], result["suggestions"])

        # optional email
        email_warning = None
        should_send = (sendEmail or "").lower() == "true"
        if should_send and email:
            try:
                # convert URL path to disk path for attachment
                disk_path = os.path.join(REPORTS_DIR, os.path.basename(pdf_url_path))
                send_email(email, disk_path, result["score"])
            except Exception as e:
                email_warning = str(e)

        payload = { "id": report_id, **result, "pdfPath": pdf_url_path }
        if email_warning:
            payload["emailWarning"] = email_warning
        return JSONResponse(payload)

    except HTTPException:
        raise
    except Exception as e:
        # surface a readable error to FE
        return JSONResponse(status_code=500, content={"error":"server_error","message":str(e)})
    finally:
        # cleanup upload
        try:
            if os.path.exists(saved_path):
                os.remove(saved_path)
        except:
            pass

# entry
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
