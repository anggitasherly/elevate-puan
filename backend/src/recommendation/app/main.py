from fastapi import FastAPI, HTTPException

from app.engines.pipeline import run_recommendation_pipeline
from app.schemas.recommendation import (
    RecommendationRequest,
    RecommendationResponse,
)


app = FastAPI(
    title="Elevate Puan Recommendation Engine",
    description=(
        "Stateless recommendation service. Next.js prepares and validates "
        "business data; this service evaluates the supplied candidates."
    ),
    version="1.1.0",
)


@app.get("/")
def root():
    return {
        "success": True,
        "message": "Elevate Puan Recommendation Engine is running.",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "recommendation-engine",
    }


@app.post(
    "/recommendations",
    response_model=RecommendationResponse,
    summary="Generate experiment recommendations",
)
def generate_recommendations(
    request: RecommendationRequest,
) -> RecommendationResponse:
    """Validate the request, run the deterministic engine, and return results.

    This endpoint intentionally does not access Supabase, call Gemini, or
    persist proposals. Those responsibilities belong to the Next.js layer.
    """
    try:
        result = run_recommendation_pipeline(
            request=request,
            max_results=3,
        )
        return RecommendationResponse.model_validate(result)
    except ValueError as exc:
        # Business/input errors that pass the structural schema but cannot
        # be processed by the engine are reported as a client error.
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    except Exception as exc:
        # Keep internal implementation details out of the public response.
        raise HTTPException(
            status_code=500,
            detail="Recommendation engine gagal memproses permintaan.",
        ) from exc
