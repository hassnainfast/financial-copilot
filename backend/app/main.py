import os
import json
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any, Literal
from supabase import create_client
import google.generativeai as genai
from gtts import gTTS
import speech_recognition as sr
from datetime import date
import uvicorn
from dotenv import load_dotenv

load_dotenv()

if not os.getenv("SUPABASE_URL"):
    raise ValueError("Missing SUPABASE_URL in .env")

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model_vision = genai.GenerativeModel('gemini-2.5-flash')
model_text = genai.GenerativeModel('gemini-2.5-flash')

app = FastAPI(title="Financial Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- HELPERS ---
def generate_audio(text: str, filename: str = "response.mp3"):
    """Generates MP3 and returns relative path."""
    try:
        tts = gTTS(text=text, lang='ur')
        filepath = f"static/{filename}"
        os.makedirs("static", exist_ok=True)
        tts.save(filepath)
        return filepath
    except Exception as e:
        print(f"Audio gen error: {e}")
        return None

def extract_json_from_llm(response_text: str) -> List[Dict]:
    """Cleans LLM output and parses JSON."""
    clean_text = response_text.replace('```json', '').replace('```', '').strip()
    try:
        data = json.loads(clean_text)
        return data if isinstance(data, list) else [data]
    except:
        return []

# ==========================================
# 1. MANUAL ENTRY
# ==========================================
@app.post("/transactions/manual/preview")
async def manual_preview(
    user_id: str = Form(...),
    amount: float = Form(...),
    type: str = Form(...),
    category: str = Form(...),
    customer_name: str = Form(...),
    description: str = Form(...),
    transaction_date: str = Form(...),
    source: str = Form(...)
):
    data = {
        "user_id": user_id, "amount": amount, "type": type, "category": category,
        "customer_name": customer_name, "description": description, 
        "transaction_date": transaction_date, "source": source
    }
    msg = f"Confirm manual entry: {data['type']} of {data['amount']} rupees from {data['customer_name']}."
    return {
        "status": "pending_verification", 
        "data": data, 
        "message": msg, 
        "audio_url": generate_audio(msg, "manual_verify.mp3")
    }

@app.post("/transactions/confirm")
async def confirm_transaction(
    user_id: str = Form(...),
    data: str = Form(...) 
):
    try:
        tx_data = json.loads(data)
        res = supabase.table("transactions").insert({
            "user_id": user_id,
            "amount": tx_data['amount'],
            "type": tx_data['type'],
            "category": tx_data['category'],
            "customer_name": tx_data.get('customer_name', 'Cash Customer'),
            "description": tx_data.get('description', ''),
            "transaction_date": tx_data.get('transaction_date', str(date.today())),
            "source": tx_data['source']
        }).execute()
        
        success_msg = f"Success! {tx_data['amount']} rupees added."
        return {
            "status": "success", 
            "message": success_msg, 
            "audio_url": generate_audio(success_msg, "success.mp3")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# 2. IMAGE ENTRY
# ==========================================
from google.generativeai.types import HarmCategory, HarmBlockThreshold # Optional safety

@app.post("/transactions/image/scan")
async def scan_receipt(file: UploadFile = File(...), user_id: str = Form(...)):
    try:
        # 1. Read the file content as bytes
        contents = await file.read()
        
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")

        print(f"✅ Received image: {file.filename} ({len(contents)} bytes)")

        # 2. Prepare the prompt
        prompt = """
        Analyze this receipt image carefully.
        
        RULES:
        1. If there are MULTIPLE distinct line items (different products/codes), DO NOT sum them up. 
           Instead, return a JSON LIST where each object is one line item.
        2. If it is a single total bill, return a list with one object.
        3. Extract: 'amount' (float), 'type' (infer: 'income' if sales, 'expense' if purchase), 
           'category' (string), 'date' (YYYY-MM-DD), 'customer_name' (or 'Cash Customer').
        
        Return ONLY a valid JSON list. Example: 
        [{"amount": 47500, "category": "Shal Kameez", ...}, {"amount": 37500, "category": "...", ...}]
        """
    
        try:
            # Create the image part explicitly
            image_part = {
                "mime_type": "image/jpeg", # Or detect from file.filename extension
                "data": contents
            }
            
            # Generate content with prompt + image part
            response = model_vision.generate_content([prompt, image_part])
            
        except Exception as ai_err:
            print(f"❌ AI Model Specific Error: {str(ai_err)}")
            raise HTTPException(status_code=500, detail=f"AI Processing Failed: {str(ai_err)}")
        
        raw_text = response.text
        print(f"🤖 AI Response Preview: {raw_text[:100]}...")

        # 4. Parse JSON
        data_list = extract_json_from_llm(raw_text)
        
        if not data_list:
            print("❌ Failed to parse JSON from AI response")
            raise HTTPException(status_code=400, detail="AI could not extract valid JSON from image")
            
        tx_data = data_list[0]
        
        # Normalize keys
        if 'total_amount' in tx_data:
            tx_data['amount'] = tx_data['total_amount']
            
        if 'amount' not in tx_data:
             raise HTTPException(status_code=400, detail="AI failed to find an amount in the image")

        tx_data['source'] = 'image'
        
        msg = f"I scanned: {tx_data['type']} of {tx_data['amount']} rupees. Is this correct?"
        
        return {
            "status": "pending_verification", 
            "data": tx_data, 
            "message": msg, 
            "audio_url": generate_audio(msg, "image_verify.mp3")
        }

    except Exception as e:
        import traceback
        print("\n" + "="*50)
        print("❌ CRITICAL ERROR in Image Scan:")
        print(traceback.format_exc()) # This will now show the REAL error
        print("="*50 + "\n")
        raise HTTPException(status_code=500, detail=str(e))
    
# ==========================================
# 3. AUDIO ENTRY (State Machine)
# ==========================================
@app.post("/transactions/audio/start")
async def audio_start(file: UploadFile = File(...), user_id: str = Form(...)):
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(file.file) as source:
            audio_data = recognizer.record(source)
            spoken_text = recognizer.recognize_google(audio_data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Audio error: {str(e)}")

    prompt = f"""
    Analyze: '{spoken_text}'. 
    Split into separate transactions if multiple amounts/people mentioned.
    Return JSON LIST: [{{'amount': float, 'type': 'income/expense', 'category': str, 'customer_name': str, 'description': str}}]
    """
    
    response = model_text.generate_content(prompt)
    tx_list = extract_json_from_llm(response.text)
    
    if not tx_list:
        return {
            "status": "error", 
            "message": "No transactions found.", 
            "audio_url": generate_audio("I didn't catch any numbers. Please try again.", "audio_error.mp3")
        }

    current_tx = tx_list[0]
    msg = f"I heard {len(tx_list)} transactions. First: {current_tx['amount']} rupees. Income or Expense?"
    
    return {
        "status": "asking_type",
        "current_index": 0,
        "pending_transactions": tx_list,
        "message": msg,
        "audio_url": generate_audio(msg, "audio_start.mp3")
    }

@app.post("/transactions/audio/next")
async def audio_next(
    user_id: str = Form(...),
    step: str = Form(...),
    user_reply: str = Form(...),
    pending_transactions: str = Form(...),
    current_index: int = Form(...)
):
    tx_list = json.loads(pending_transactions)
    if current_index >= len(tx_list):
        return {"status": "finished", "message": "All transactions completed."}

    current_tx = tx_list[current_index].copy()
    next_step = ""
    msg = ""
    
    if step == "asking_type":
        current_tx['type'] = user_reply.lower()
        msg = "Who was the customer or what item?"
        next_step = "asking_customer"
        
    elif step == "asking_customer":
        p_resp = model_text.generate_content(f"Extract customer_name and category from '{user_reply}'. JSON only.")
        parsed_list = extract_json_from_llm(p_resp.text)
        parsed = parsed_list[0] if parsed_list else {}
        
        current_tx['customer_name'] = parsed.get('customer_name', 'Cash Customer')
        current_tx['category'] = parsed.get('category', 'General')
        
        msg = f"Save: {current_tx['amount']} {current_tx['type']} for {current_tx['customer_name']}? Say Yes."
        next_step = "confirm"
        
    elif step == "confirm":
        if "yes" in user_reply.lower():
            try:
                supabase.table("transactions").insert({
                    "user_id": user_id, 
                    "amount": current_tx['amount'],
                    "type": current_tx['type'],
                    "category": current_tx['category'],
                    "customer_name": current_tx.get('customer_name', 'Cash Customer'),
                    "description": current_tx.get('description', ''),
                    "source": "audio", 
                    "transaction_date": str(date.today())
                }).execute()
                
                msg = f"Saved {current_tx['amount']}!"
                
                if current_index + 1 < len(tx_list):
                    next_tx = tx_list[current_index+1]
                    msg += f" Next: {next_tx['amount']}. Income or Expense?"
                    next_step = "asking_type"
                    current_index += 1
                else:
                    next_step = "finished"
                    msg += " All done!"
            except Exception as e:
                msg = f"Error saving: {str(e)}"
                next_step = "error"
        else:
            msg = "Restarting. What was the amount?"
            next_step = "restart" # Frontend should handle restart logic

    return {
        "status": next_step,
        "current_index": current_index,
        "pending_transactions": json.dumps(tx_list),
        "message": msg,
        "audio_url": generate_audio(msg, f"audio_{step}.mp3")
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)