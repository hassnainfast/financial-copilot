# Financial Copilot

An AI-powered financial assistant for shopkeepers, built with a modern web stack.

## Tech Stack
*   **Frontend**: Next.js, React
*   **Backend**: FastAPI, Python
*   **Database**: PostgreSQL (Supabase)
*   **AI Models**: Gemini / Groq / Langchain
*   **Vector DB**: Qdrant (planned)

## Current Progress & Functionality
Based on the architecture map, here is the status of the project:

### ✅ Fully Implemented (Frontend + Backend)
*   **Data Entry**:
    *   **Manual Entry**: Fully functional with `ManualEntryWorkflow` in backend and frontend UI.
    *   **Image/Receipt Scanning**: Active `ImageEntryWorkflow` in the backend connected to `app/entry/image` on the frontend.
    *   **Audio/Voice Logging**: `AudioEntryWorkflow` utilizing Speech-To-Text processing working directly with the frontend's `voice` module.
*   **Inventory Tracking**: Integrated with manual and incoming sales inputs.

### 🚧 Partial or Missing Implementation (Frontend exists, Backend missing)
*   **Goals**: Frontend UI (`/goals`) exists, but `goals.py` routes are missing from the backend FastAPI application.
*   **Analytics & Spending Patterns**: Visual components (`/analytics`) present on frontend, but specific backend data aggregation routes aren't explicitly formed yet (besides general transaction fetching).
*   **Predictions**: Mocked or purely frontend driven. No ML backend implementation yet for forecasting.
*   **Alerts/Progress & Real-time Tracking**: Need WebSocket or Polling backend endpoints to push alerts in real-time.
*   **Balance Sheet Automation**: No backend implementation.
*   **RAG (Retrieval-Augmented Generation)**: Vector database (Qdrant) integration and document parsing/chunking pipelines are missing.

---

## How to Run Locally

### Prerequisites
*   [Node.js](https://nodejs.org/) (v16+)
*   [Python](https://www.python.org/) 3.10+
*   [`uv`](https://github.com/astral-sh/uv) (Extremely fast Python package installer and resolver)

### Backend Setup
1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Install dependencies using `uv` (it uses the existing `pyproject.toml` and `uv.lock`):
    ```bash
    uv venv
    # On Windows: .venv\Scripts\activate
    # On macOS/Linux: source .venv/bin/activate
    uv pip install -r pyproject.toml
    ```
3.  Set up environment variables:
    *   Review `.env.example` (or existing `.env`) inside the backend folder.
    *   Ensure your Supabase keys, API keys for Gemini/Groq, etc., are configured.
4.  Run the FastAPI backend server:
    ```bash
    uvicorn app.main:app --reload
    # Or, if you have a dev script configured:
    # fastapi run app/main.py
    ```
    *The API will start at `http://localhost:8000`*

### Frontend Setup
1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install NPM packages:
    ```bash
    npm install
    ```
3.  Configure `.env` for the frontend if needed (e.g., pointing to `http://localhost:8000`).
4.  Run the Next.js development server:
    ```bash
    npm run dev
    ```
    *The web view will be accessible at `http://localhost:3000`*
