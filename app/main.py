from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .sample_data import initial_state, timestamp


app = FastAPI(
    title="Exam Correction MVP",
    description="AI-assisted descriptive exam correction demo for teachers, students, and college management.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")

STATE = initial_state()


class OverrideRequest(BaseModel):
    marks: float = Field(ge=0)
    comment: str = Field(default="", max_length=500)


class RoiRequest(BaseModel):
    scripts: int = Field(default=50000, ge=1, le=1000000)
    pages_per_script: int = Field(default=10, ge=1, le=80)
    current_cost_per_script: float = Field(default=35, ge=1, le=500)
    platform_cost_per_script: float = Field(default=15, ge=1, le=500)
    current_days: int = Field(default=30, ge=1, le=120)
    projected_days: int = Field(default=4, ge=1, le=120)


@app.get("/")
def root() -> FileResponse:
    return FileResponse("static/index.html")


@app.get("/api/demo")
def get_demo() -> dict:
    return STATE


@app.post("/api/questions/{question_id}/override")
def override_question(question_id: str, payload: OverrideRequest) -> dict:
    question = next((item for item in STATE["questions"] if item["id"] == question_id), None)
    if question is None:
        raise HTTPException(status_code=404, detail="Question not found")
    if payload.marks > question["max_marks"]:
        raise HTTPException(status_code=400, detail="Marks exceed maximum for this question")

    question["teacher_marks"] = payload.marks
    question["teacher_comment"] = payload.comment
    question["overridden"] = payload.marks != question["suggested_marks"] or bool(payload.comment.strip())
    _sync_score()
    return {"question": question, "summary": STATE["script"]["summary"], "report": STATE["report"]}


@app.post("/api/sign-off")
def sign_off() -> dict:
    STATE["signed_off"] = True
    STATE["signed_off_at"] = timestamp()
    STATE["script"]["status"] = "Teacher signed off"
    return {
        "signed_off": STATE["signed_off"],
        "signed_off_at": STATE["signed_off_at"],
        "script": STATE["script"],
    }


@app.post("/api/reset")
def reset_demo() -> dict:
    global STATE
    STATE = initial_state()
    return STATE


@app.post("/api/roi")
def calculate_roi(payload: RoiRequest) -> dict:
    current_cost = payload.scripts * payload.current_cost_per_script
    platform_cost = payload.scripts * payload.platform_cost_per_script
    savings = current_cost - platform_cost
    time_saved_days = max(payload.current_days - payload.projected_days, 0)
    pages = payload.scripts * payload.pages_per_script

    return {
        "scripts": payload.scripts,
        "pages": pages,
        "current_cost": round(current_cost, 2),
        "platform_cost": round(platform_cost, 2),
        "savings": round(savings, 2),
        "savings_percent": round((savings / current_cost) * 100, 1),
        "current_days": payload.current_days,
        "projected_days": payload.projected_days,
        "time_saved_days": time_saved_days,
    }


def _sync_score() -> None:
    total = sum(float(item["teacher_marks"]) for item in STATE["questions"])
    max_score = sum(float(item["max_marks"]) for item in STATE["questions"])
    STATE["script"]["summary"]["ai_score"] = total
    STATE["script"]["summary"]["max_score"] = max_score
    STATE["report"]["score"] = total
    STATE["report"]["max_score"] = max_score
