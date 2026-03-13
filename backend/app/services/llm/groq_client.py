import json
import re
from typing import Dict, Any
from groq import Groq
from app.config import GROQ_API_KEY, GROQ_MODEL
from app.services.llm.base import BaseLLM

class GroqClient(BaseLLM):
    def __init__(self):
        self.client = Groq(api_key=GROQ_API_KEY)
        self.model = GROQ_MODEL
    
    async def generate_text(self, prompt: str, **kwargs) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=kwargs.get("temperature", 0.7),
            max_tokens=kwargs.get("max_tokens", 1000)
        )
        return response.choices[0].message.content.strip()
    
    async def generate_json(self, prompt: str, **kwargs) -> Dict[str, Any]:
        system_prompt = "Return ONLY valid JSON. No markdown, no explanations."
        full_prompt = f"{system_prompt}\n\n{prompt}"
        
        for attempt in range(3):
            try:
                response = await self.generate_text(full_prompt, **kwargs)
                clean_json = self._extract_json(response)
                return json.loads(clean_json)
            except Exception as e:
                if attempt == 2:
                    raise ValueError(f"Failed to parse JSON: {e}")
                continue
        return {}
    
    def _extract_json(self, text: str) -> str:
        text = re.sub(r'```json\s*', '', text)
        text = re.sub(r'```\s*', '', text)
        if '{' in text and '}' in text:
            start = text.find('{')
            end = text.rfind('}') + 1
            return text[start:end]
        return text.strip()
    
    async def generate_from_image(self, image_bytes: bytes, prompt: str) -> str:
        raise NotImplementedError("Use Gemini for image processing")
