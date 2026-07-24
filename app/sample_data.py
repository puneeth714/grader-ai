from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone


SCRIPT = {
    "id": "TS-2026-9041",
    "masked_student": "Masked during evaluation",
    "subject": "Physics",
    "exam": "Internal Assessment - Descriptive Paper",
    "course": "B.Tech First Year",
    "max_marks": 20,
    "image_url": "/static/assets/handwritten_exam_script.jpg",
    "status": "AI pre-evaluated",
    "summary": {
        "ai_score": 15,
        "max_score": 20,
        "confidence": 0.89,
        "estimated_teacher_time_seconds": 58,
        "manual_time_seconds": 420,
    },
}


QUESTIONS = [
    {
        "id": "q1",
        "label": "Q1",
        "title": "Define inertia and explain its role in rotational motion.",
        "max_marks": 5,
        "suggested_marks": 4,
        "teacher_marks": 4,
        "confidence": 0.92,
        "rubric": [
            {"text": "Clear definition of inertia", "marks": 1.5, "matched": True},
            {"text": "Connects inertia to resistance to angular acceleration", "marks": 1.5, "matched": True},
            {"text": "Mentions dependence on mass distribution", "marks": 1.0, "matched": True},
            {"text": "Uses correct terminology throughout", "marks": 1.0, "matched": False},
        ],
        "ai_reason": "The answer correctly explains resistance to rotational change and mentions mass distribution. It loses one mark for imprecise terminology in the final sentence.",
        "annotation": {
            "x": 18,
            "y": 18,
            "w": 64,
            "h": 18,
            "type": "correct",
            "label": "+4/5",
        },
    },
    {
        "id": "q2",
        "label": "Q2",
        "title": "Solve the numerical problem using the moment of inertia formula.",
        "max_marks": 8,
        "suggested_marks": 5,
        "teacher_marks": 5,
        "confidence": 0.84,
        "rubric": [
            {"text": "Selects correct base formula", "marks": 2.0, "matched": True},
            {"text": "Substitutes radius and mass correctly", "marks": 2.0, "matched": True},
            {"text": "Carries units through calculation", "marks": 1.5, "matched": False},
            {"text": "Computes final numeric answer correctly", "marks": 2.5, "matched": False},
        ],
        "ai_reason": "The setup is mostly correct, but the final numerical simplification appears inconsistent and the unit is omitted.",
        "annotation": {
            "x": 14,
            "y": 40,
            "w": 70,
            "h": 22,
            "type": "warning",
            "label": "check calculation",
        },
    },
    {
        "id": "q3",
        "label": "Q3",
        "title": "Draw and label the required diagram.",
        "max_marks": 7,
        "suggested_marks": 6,
        "teacher_marks": 6,
        "confidence": 0.9,
        "rubric": [
            {"text": "Relevant diagram present", "marks": 2.0, "matched": True},
            {"text": "Labels force, axis, and radius", "marks": 2.0, "matched": True},
            {"text": "Shows direction conventions", "marks": 1.5, "matched": True},
            {"text": "Diagram is neat enough for evaluation", "marks": 1.5, "matched": False},
        ],
        "ai_reason": "The main elements are present and direction is visible. Presentation is weak, so one mark is deducted.",
        "annotation": {
            "x": 20,
            "y": 66,
            "w": 58,
            "h": 20,
            "type": "correct",
            "label": "+6/7",
        },
    },
]


REPORT = {
    "student_display": "Student report preview",
    "score": 15,
    "max_score": 20,
    "grade_band": "Needs targeted practice",
    "concept_mastery": [
        {"concept": "Moment of inertia definition", "score": 86},
        {"concept": "Formula selection", "score": 78},
        {"concept": "Numeric execution", "score": 48},
        {"concept": "Units and presentation", "score": 42},
    ],
    "error_patterns": [
        {
            "type": "Arithmetic execution error",
            "count": 2,
            "detail": "Final simplification and units need checking before submission.",
        },
        {
            "type": "Structural presentation issue",
            "count": 1,
            "detail": "Diagram labels are present but not cleanly separated.",
        },
        {
            "type": "Conceptual gap",
            "count": 1,
            "detail": "Definition language is close but not exam-ready.",
        },
    ],
    "recommendations": [
        "Practice 5 numerical problems focused on unit consistency.",
        "Rewrite inertia definitions using exact textbook terminology.",
        "Complete one labeled diagram drill before the next internal exam.",
    ],
    "resources": [
        {"title": "Rotational motion quick revision", "kind": "Video", "detail": "5 min targeted concept review"},
        {"title": "Moment of inertia solved examples", "kind": "Textbook", "detail": "Chapter 7, examples 4 to 6"},
        {"title": "Custom practice sheet", "kind": "Worksheet", "detail": "3 problems generated from weak concepts"},
    ],
}


PILOT = {
    "title": "100-paper campus pilot",
    "days": [
        {"day": "Day 1", "title": "Scan", "detail": "Use existing campus scanner for 100 recent internal exam scripts."},
        {"day": "Day 2", "title": "Pre-evaluate", "detail": "Run AI annotation, rubric scoring, and diagnostic report generation."},
        {"day": "Day 3", "title": "Faculty review", "detail": "Three faculty members review accuracy, time saved, and override rate."},
    ],
    "success_criteria": [
        "Teacher review time reduced by at least 60 percent.",
        "Faculty accepts score suggestions for at least 80 percent of questions.",
        "Every approved script contains visible correction marks and score history.",
        "Management sees a clear path to lower correction cost per script.",
    ],
}


def initial_state() -> dict:
    return {
        "script": deepcopy(SCRIPT),
        "questions": deepcopy(QUESTIONS),
        "report": deepcopy(REPORT),
        "pilot": deepcopy(PILOT),
        "signed_off": False,
        "signed_off_at": None,
    }


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
