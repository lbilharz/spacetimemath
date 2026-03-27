import requests

payload = {
    "secret_key": "hf-bot-secret",
    "target_player": "c20084a558509890fa24bc2bb4f38075fe0ee5878afacc8a38ae333d4b68fb0e",
    "weights": [0.5]*11
}
url = "https://maincloud.spacetimedb.com/v1/database/spacetimemath/call/update_dkt_weights"
res = requests.post(url, json=payload)
print("Response Text:", res.text)
