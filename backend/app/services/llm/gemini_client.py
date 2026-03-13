import json
import google.generativeai as genai
from typing import Dict, Any
from app.config import GEMINI_API_KEY, GEMINI_MODEL
from app.services.llm.base import BaseLLM
import warnings
warnings.filterwarnings("ignore", category=FutureWarning, module="google.generativeai")

class GeminiClient(BaseLLM):
    def __init__(self):
        genai.configure(api_key=GEMINI_API_KEY)
        self.model = genai.GenerativeModel(GEMINI_MODEL)
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        response = self.model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=kwargs.get("temperature", 0.7),
                max_output_tokens=kwargs.get("max_tokens", 1000)
            )
        )
        return response.text.strip()
    
    async def generate_json(self, prompt: str, **kwargs) -> Dict[str, Any]:
        system_prompt = "Return ONLY valid JSON. No markdown, no explanations."
        full_prompt = f"{system_prompt}\n\n{prompt}"
        response = await self.generate_text(full_prompt, **kwargs)
        clean_json = response.replace('```json', '').replace('```', '').strip()
        return json.loads(clean_json)
    
    async def generate_from_image(self, image_bytes: bytes, prompt: str) -> str:
        image_part = {"mime_type": "image/jpeg", "data": image_bytes}
        response = self.model.generate_content([prompt, image_part])
        return response.text.strip()
