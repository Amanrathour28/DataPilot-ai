import urllib.request
import urllib.error
import json

BASE_URL = 'https://datapilot-backend-five.vercel.app/api/v1'

def inspect():
    # Login with the user we just created or register a fresh one
    email = "debug_user@datapilot.ai"
    password = "Password123!"

    # Register/login
    req = urllib.request.Request(f"{BASE_URL}/auth/register", data=json.dumps({"name": "Debug User", "email": email, "password": password}).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            token = data["access_token"]
    except urllib.error.HTTPError as e:
        # try login
        req = urllib.request.Request(f"{BASE_URL}/auth/login", data=json.dumps({"email": email, "password": password}).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            token = data["access_token"]

    print("Logged in, token:", token[:15])

    # Get workspaces
    req = urllib.request.Request(f"{BASE_URL}/workspaces", headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req) as resp:
        workspaces = json.loads(resp.read().decode("utf-8"))
        ws_id = workspaces[0]["id"]

    print("Workspace ID:", ws_id)

    # Let's inspect one of the failed investigations from the DB:
    failed_inv_id = "c8a2a9e1-2787-4970-aaca-a6c98273b28a"
    try:
        req = urllib.request.Request(f"{BASE_URL}/investigations/{failed_inv_id}/debug", headers={"Authorization": f"Bearer {token}"})
        with urllib.request.urlopen(req) as resp:
            debug_info = json.loads(resp.read().decode("utf-8"))
            print("Debug of failed inv:", json.dumps(debug_info, indent=2))
    except urllib.error.HTTPError as e:
        print("Failed to get debug:", e.code, e.read().decode("utf-8"))

    # Now let's try creating an investigation with verbose error capture
    req = urllib.request.Request(
        f"{BASE_URL}/investigations?workspace_id={ws_id}",
        data=json.dumps({"objective": "Test investigation error capture", "workspace_id": ws_id}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print("Create inv success:", resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print("Create inv failed:", e.code, e.read().decode("utf-8"))

if __name__ == "__main__":
    inspect()
