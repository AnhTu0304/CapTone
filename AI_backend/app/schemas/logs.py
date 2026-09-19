from pydantic import BaseModel


class LogAnalysisResult(BaseModel):
    agent: str = "log_analysis"
    important_logs: list[str]
    detected_errors: list[str]
    suspected_causes: list[str]
