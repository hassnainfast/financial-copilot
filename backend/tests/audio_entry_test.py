import requests
import json
import time

BASE_URL = "http://localhost:8001/api"

def separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def print_items(items):
    """Pretty print extracted items."""
    if not items:
        print("  (no items)")
        return
    for i, item in enumerate(items):
        name = item.get("item_name", "?")
        amount = item.get("amount", 0)
        qty = item.get("quantity", 1)
        cat = item.get("category", "?")
        print(f"  {i+1}. {name} | {amount} PKR | Qty: {qty} | Category: {cat}")

def test_audio_full_flow():
    """Test the complete audio entry flow: add → edit → remove → add more → confirm."""
    
    separator("1. START AUDIO SESSION (Income)")
    
    resp = requests.post(f"{BASE_URL}/transactions/audio/start", data={
        "user_id": "user_01",
        "type": "income"
    })
    
    if resp.status_code != 200:
        print(f"❌ Start failed: {resp.status_code} - {resp.text}")
        return
    
    result = resp.json()
    session_id = result["session_id"]
    print(f"✅ Session: {session_id}")
    print(f"📋 Step: {result['next_step']}")
    print(f"🔊 Message: {result['message']}")
    print(f"🎵 Audio: {result.get('audio_url', 'N/A')}")
    
    # ─── Step 2: Send first batch of items ───
    separator("2. ADD ITEMS (First batch)")
    
    resp = requests.post(f"{BASE_URL}/transactions/audio/continue", data={
        "session_id": session_id,
        "user_text": "mene aaj 1000 rupay ka 1 shampoo beche aur 500 rupay ka sabun bhi becha"
    })
    
    if resp.status_code != 200:
        print(f"❌ Continue failed: {resp.status_code} - {resp.text}")
        return
    
    result = resp.json()
    print(f"📋 Step: {result['next_step']}")
    print(f"🔊 Message: {result['message']}")
    
    items = result.get("data", {}).get("extracted_items", [])
    print(f"\n📦 Extracted Items ({len(items)}):")
    print_items(items)
    
    total = result.get("data", {}).get("total_amount", 0)
    print(f"\n💰 Total: {total} PKR")
    print(f"➕ New items: {result.get('data', {}).get('new_items_count', 0)}")
    
    # ─── Step 3: Edit an item ───
    separator("3. EDIT ITEM (Change shampoo price)")
    time.sleep(1)  # Small delay for rate limiting
    
    resp = requests.post(f"{BASE_URL}/transactions/audio/continue", data={
        "session_id": session_id,
        "user_text": "shampoo ka price 1500 kardo, 1000 nahi 1500 hai"
    })
    
    if resp.status_code != 200:
        print(f"❌ Edit failed: {resp.status_code} - {resp.text}")
        return
    
    result = resp.json()
    print(f"📋 Step: {result['next_step']}")
    print(f"🔊 Message: {result['message']}")
    
    items = result.get("data", {}).get("extracted_items", [])
    print(f"\n📦 Updated Items ({len(items)}):")
    print_items(items)
    print(f"✏️ Edits applied: {result.get('data', {}).get('edits_count', 0)}")
    
    # ─── Step 4: Remove an item ───
    separator("4. REMOVE ITEM (Remove sabun)")
    time.sleep(1)
    
    resp = requests.post(f"{BASE_URL}/transactions/audio/continue", data={
        "session_id": session_id,
        "user_text": "shampoo wala item hata do list se"
    })
    
    if resp.status_code != 200:
        print(f"❌ Remove failed: {resp.status_code} - {resp.text}")
        return
    
    result = resp.json()
    print(f"📋 Step: {result['next_step']}")
    print(f"🔊 Message: {result['message']}")
    
    items = result.get("data", {}).get("extracted_items", [])
    print(f"\n📦 Updated Items ({len(items)}):")
    print_items(items)
    print(f"🗑️ Removals: {result.get('data', {}).get('removals_count', 0)}")
    
    # ─── Step 5: Add more items ───
    separator("5. ADD MORE ITEMS")
    time.sleep(1)
    
    resp = requests.post(f"{BASE_URL}/transactions/audio/continue", data={
        "session_id": session_id,
        "user_text": "aur 300 rupay ki 2 chocolate bhi khareedi aur 200 ka biscuit bhi khareeda"
    })
    
    if resp.status_code != 200:
        print(f"❌ Add more failed: {resp.status_code} - {resp.text}")
        return
    
    result = resp.json()
    print(f"📋 Step: {result['next_step']}")
    print(f"🔊 Message: {result['message']}")
    
    items = result.get("data", {}).get("extracted_items", [])
    print(f"\n📦 Updated Items ({len(items)}):")
    print_items(items)
    
    total = result.get("data", {}).get("total_amount", 0)
    print(f"\n💰 Total: {total} PKR")
    
    # ─── Step 6: Confirm and save ───
    separator("6. CONFIRM AND SAVE")
    time.sleep(1)
    
    resp = requests.post(f"{BASE_URL}/transactions/audio/continue", data={
        "session_id": session_id,
        "user_text": "haan sab theek hai, save kardo"
    })
    
    if resp.status_code != 200:
        print(f"❌ Confirm failed: {resp.status_code} - {resp.text}")
        return
    
    result = resp.json()
    print(f"📋 Step: {result['next_step']}")
    print(f"🔊 Message: {result['message']}")
    print(f"✅ Complete: {result['is_complete']}")
    
    if result["is_complete"]:
        data = result.get("data", {})
        print(f"\n🎉 Transaction IDs: {data.get('transaction_ids', [])}")
        print(f"📦 Items saved: {len(data.get('items_saved', []))}")
        print(f"💰 Total: {data.get('total_amount', 0)} PKR")
        print(f"📊 Inventory updates: {len(data.get('inventory_updates', []))}")
        
        for update in data.get("inventory_updates", []):
            print(f"  • {update['item_name']}: {update['action']} ({update['old_qty']} → {update['new_qty']})")
    
    separator("TEST COMPLETE! ✅")

def test_audio_quick():
    """Quick test: start session + one message."""
    
    separator("QUICK TEST: Start + One Message")
    
    resp = requests.post(f"{BASE_URL}/transactions/audio/start", data={
        "user_id": "user_01",
        "type": "expense"
    })
    
    result = resp.json()
    session_id = result["session_id"]
    print(f"✅ Session: {session_id}")
    print(f"🔊 Message: {result['message']}")
    
    time.sleep(1)
    
    resp = requests.post(f"{BASE_URL}/transactions/audio/continue", data={
        "session_id": session_id,
        "user_text": "mene aaj 5000 rupay ka 10 kg chawal khareed liya wholesaler se"
    })
    
    result = resp.json()
    print(f"\n📋 Step: {result['next_step']}")
    print(f"🔊 Message: {result['message']}")
    
    items = result.get("data", {}).get("extracted_items", [])
    print(f"\n📦 Extracted Items ({len(items)}):")
    print_items(items)
    
    separator("QUICK TEST DONE ✅")

if __name__ == "__main__":
    print("\n🎤 Audio Entry Test Suite")
    print("========================\n")
    
    choice = input("Run which test?\n  1. Full flow (add → edit → remove → add → confirm)\n  2. Quick test (start + one message)\n\nChoice (1/2): ").strip()
    
    if choice == "1":
        test_audio_full_flow()
    elif choice == "2":
        test_audio_quick()
    else:
        print("Running full flow by default...")
        test_audio_full_flow()
