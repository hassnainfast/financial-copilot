import json
from typing import Dict, Any
from app.services.llm.groq_client import GroqClient
from app.services.llm.gemini_client import GeminiClient

class LLMOrchestrator:
    def __init__(self):
        self.groq = GroqClient()
        self.gemini = GeminiClient()
    
    async def extract_transaction_data(self, text: str) -> Dict[str, Any]:
        prompt = f'Extract transaction from: "{text}". Return JSON with amount, type, category, customer_name.'
        return await self.groq.generate_json(prompt)
    
    async def generate_confirmation_message(self, data: Dict[str, Any], language: str = "ur") -> str:
        prompt = f"Generate {language} confirmation for: Amount {data.get('amount')}, Type {data.get('type')}"
        return await self.groq.generate_text(prompt)
    
    async def analyze_receipt(self, image_bytes: bytes):
        prompt = "Analyze receipt. Return JSON list with amount, type, category, customer_name."
        response_text = await self.gemini.generate_from_image(image_bytes, prompt)
        clean_text = response_text.replace('```json', '').replace('```', '').strip()
        if '[' in clean_text and ']' in clean_text:
            start = clean_text.find('[')
            end = clean_text.rfind(']') + 1
            return json.loads(clean_text[start:end])
        return []
    
    async def correct_transaction(self, original: Dict[str, Any], user_correction: str) -> Dict[str, Any]:
        prompt = f"Original: {json.dumps(original)}. Correction: {user_correction}. Return updated JSON."
        return await self.groq.generate_json(prompt)
    
    async def generate_audio_script(self, message: str, context: str = "") -> str:
        prompt = f"Convert to Urdu: {message}. Keep it conversational. Urdu script only."
        return await self.groq.generate_text(prompt)
