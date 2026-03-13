import requests
import json
import time
# Optional: pip install playsound==1.2.2 if you want actual audio
# from playsound import playsound 

BASE_URL = "http://localhost:8000"

def test_image_flow():
    print("📸 Starting Image Transaction Test...")
    
    filename = "receipt.jpg" 
    
    try:
        with open(filename, "rb") as f:
            files = {"file": (filename, f, "image/jpeg")}
            data = {"user_id": "user_01"}
            
            print(f"⬆️ Uploading {filename}...")
            resp = requests.post(f"{BASE_URL}/transactions/image/scan", files=files, data=data)
            
            if resp.status_code != 200:
                print(f"❌ Server Error {resp.status_code}: {resp.text}")
                return

            scan_result = resp.json()
            extracted_data = scan_result.get('data')
            
            # Handle if AI returns a list or a single dict
            if isinstance(extracted_data, dict):
                transactions_list = [extracted_data]
            else:
                transactions_list = extracted_data

            print(f"✅ AI Found {len(transactions_list)} transaction(s):")
            for i, tx in enumerate(transactions_list):
                print(f"   {i+1}. Amount: {tx.get('amount')} | Category: {tx.get('category')}")

            # 🔊 AUDIO SIMULATION (Prints to console)
            msg = scan_result.get('message')
            print(f"\n🔊 SYSTEM SAYS: '{msg}'")
            # if you installed playsound: playsound(scan_result.get('audio_url'))

            # 🛑 PAUSE FOR CONFIRMATION
            choice = input("\n❓ Is this correct? (yes/no): ").strip().lower()
            
            if choice != 'yes':
                print("❌ Aborted by user.")
                return

            # 2. Confirm Step
            print("2️⃣ Confirming Transaction(s)...")
            
            # If there are multiple items, we might need to loop confirmations 
            # But for now, let's assume we confirm the whole batch or the first one
            # To keep it simple, we will confirm the FIRST item found, or the total if summed.
            # Ideally, your frontend would show a list and let user edit.
            
            confirm_payload = {
                "user_id": "user_01",
                "data": json.dumps(transactions_list[0]) # Confirming the first item
            }
            
            confirm_resp = requests.post(f"{BASE_URL}/transactions/confirm", data=confirm_payload)
            result = confirm_resp.json()
            
            if result.get('status') == 'success':
                print(f"🎉 SUCCESS! {result.get('message')}")
                
                # If there were more items, offer to add them
                if len(transactions_list) > 1:
                    print(f"⚠️ Note: There were {len(transactions_list)-1} other items found. You may need to upload again or add manually.")
            else:
                print(f"❌ Confirmation Failed: {result}")
                
    except FileNotFoundError:
        print(f"❌ Error: '{filename}' not found!")
    except Exception as e:
        print(f"💥 Script Crashed: {e}")

if __name__ == "__main__":
    test_image_flow()