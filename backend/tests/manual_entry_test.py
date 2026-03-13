import requests

BASE_URL = "http://localhost:8000"

def test_manual_flow():
    print("🚀 Starting Manual Transaction Test...")
    
    # 1. Send Preview
    print("1️⃣ Sending Preview...")
    payload = {
        "user_id": "user_01",
        "amount": 500,
        "type": "income",
        "category": "Sales",
        "customer_name": "Ali Khan",
        "description": "Sold Rice",
        "transaction_date": "2026-03-13",
        "source": "manual"
    }
    
    resp = requests.post(f"{BASE_URL}/transactions/manual/preview", data=payload)
    preview_data = resp.json()
    
    if preview_data.get('status') == 'pending_verification':
        print(f"✅ Preview Received: {preview_data.get('message')}")
        
        # 2. Confirm
        print("2️⃣ Confirming Transaction...")
        import json
        confirm_payload = {
            "user_id": "user_01",
            "data": json.dumps(preview_data['data']) 
        }
        
        confirm_resp = requests.post(f"{BASE_URL}/transactions/confirm", data=confirm_payload)
        result = confirm_resp.json()
        
        if result.get('status') == 'success':
            print(f"🎉 SUCCESS! {result.get('message')}")
            print("👉 CHECK YOUR SUPABASE DASHBOARD NOW!")
        else:
            print(f"❌ Failed to confirm: {result}")
    else:
        print(f"❌ Preview failed: {preview_data}")

if __name__ == "__main__":
    test_manual_flow()