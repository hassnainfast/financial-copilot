import json
from typing import Dict, Any, List
from app.services.llm.groq_client import GroqClient
from app.services.llm.gemini_client import GeminiClient
from app.prompts.extraction_prompt import IMAGE_ANALYSIS_PROMPT

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
    
    async def extract_audio_transaction(self, messages: List[Dict[str, str]]) -> Dict[str, Any]:
        """
        Extract transaction data from audio conversation using multi-turn chat.
        
        Args:
            messages: Full conversation history with system prompt
        
        Returns:
            Dict with: new_items, edits, removals, completion_detected, summary_urdu
        """
        result = await self.groq.generate_chat_json(messages, temperature=0.3, max_tokens=2000)
        
        # Ensure required keys exist with defaults
        result.setdefault("new_items", [])
        result.setdefault("edits", [])
        result.setdefault("removals", [])
        result.setdefault("completion_detected", False)
        result.setdefault("summary_urdu", "")
        result.setdefault("clarification_needed", None)
        
        return result
    
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
        """Generate Urdu audio script with strict output control."""
        
        prompt = f"""
    You are a Urdu translator for a financial assistant app.

    TASK: Translate this English message to natural spoken Urdu.

    MESSAGE: "{message}"
    CONTEXT: {context}

    RULES (STRICT):
    1. Return ONLY Urdu text in Urdu script (نستعلیق)
    2. NO English words
    3. NO Roman Urdu (like "theek hai")
    4. NO explanations or prefixes
    5. Keep it conversational and friendly
    6. Maximum 2 sentences
    7. Use common Pakistani Urdu phrases

    EXAMPLES:
    English: "Confirm entry: 1000 rupees"
    Urdu: "تصدیق کریں: 1000 روپے"

    English: "Success! Item saved"
    Urdu: "کامیابی! آئٹم محفوظ ہو گیا"

    English: "Image not clear. Retry?"
    Urdu: "تصویر واضح نہیں ہے۔ دوبارہ کوشش کریں؟"

    NOW TRANSLATE THIS: "{message}"

    Return ONLY the Urdu translation, nothing else:
    """
        
        urdu_text = await self.groq.generate_text(prompt)
        
        # Clean up any remaining English or extra text
        urdu_text = self._clean_urdu_text(urdu_text)
        
        return urdu_text

    def _clean_urdu_text(self, text: str) -> str:
        """Remove any English words or extra text from Urdu output."""
        import re
        
        # Remove common prefixes the LLM might add
        prefixes = [
            "Urdu:", "اردو:", "Translation:", "ترجمہ:",
            "Here:", "یہ رہا:", "Output:", "آؤٹ پٹ:",
            "The translation:", "ترجمہ یہ ہے:",
        ]
        for prefix in prefixes:
            if text.startswith(prefix):
                text = text[len(prefix):].strip()
        
        # Remove markdown or quotes
        text = text.replace('"', '').replace("'", "").strip()
        
        # Remove any trailing explanations
        if "\n" in text:
            text = text.split("\n")[0].strip()
        
        return text
    
    async def analyze_receipt(self, image_bytes: bytes) -> Dict[str, Any]:
        """Analyze receipt image and extract line items."""
        try:
            print(f"📸 Analyzing image: {len(image_bytes)} bytes")
            
            response_text = await self.gemini.generate_from_image(image_bytes, IMAGE_ANALYSIS_PROMPT)
            
            print(f"🤖 Gemini raw response:\n{response_text[:500]}...")  # DEBUG
            
            # Parse JSON from response
            import json
            import re
            
            # Clean response
            clean_text = re.sub(r'```json\s*', '', response_text)
            clean_text = re.sub(r'```\s*', '', clean_text).strip()
            
            print(f"🧹 Cleaned text:\n{clean_text[:300]}...")  # DEBUG
            
            # Find JSON object
            if '{' in clean_text and '}' in clean_text:
                start = clean_text.find('{')
                end = clean_text.rfind('}') + 1
                json_str = clean_text[start:end]
                
                print(f"📦 JSON string:\n{json_str[:300]}...")  # DEBUG
                
                result = json.loads(json_str)
                print(f"✅ Parsed result: {result}")  # DEBUG
                
                return result
            
            print("❌ No JSON found in response")  # DEBUG
            return {"items": [], "overall_confidence": 0.0}
        
        except Exception as e:
            print(f"❌ Receipt analysis error: {e}")  # DEBUG
            import traceback
            traceback.print_exc()
            return {"items": [], "overall_confidence": 0.0, "error": str(e)}