import speech_recognition as sr
from typing import Optional

class STTService:
    """Speech-to-Text service for Urdu input."""
    
    def __init__(self):
        self.recognizer = sr.Recognizer()
    
    async def transcribe_audio(self, audio_file_path: str, language: str = "ur-PK") -> Optional[str]:
        """
        Transcribe Urdu audio file to text.
        
        Args:
            audio_file_path: Path to audio file
            language: Language code (default: Urdu Pakistan)
        
        Returns:
            Transcribed text or None if failed
        """
        try:
            with sr.AudioFile(audio_file_path) as source:
                audio_data = self.recognizer.record(source)
                
            # Use Google Web Speech API (supports Urdu)
            text = self.recognizer.recognize_google(audio_data, language=language)
            return text
        
        except sr.UnknownValueError:
            print("❌ Could not understand audio")
            return None
        except sr.RequestError as e:
            print(f"❌ STT service error: {e}")
            return None
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            return None