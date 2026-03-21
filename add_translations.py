import json

files = {
    'client/src/locales/en/translation.json': {
        "title": "Sprint Complete!",
        "subtitle": "Review your class performance",
        "accuracy": "Class Accuracy",
        "totalAnswers": "Answers Computed",
        "activeRunners": "Active Runners",
        "insights": "Didactic Insights",
        "hardest": "Needs Practice",
        "fastest": "Fastest Pair",
        "slowest": "Slowest Pair",
        "leaderboard": "Sprint Podium",
        "correctShort": "DONE"
    },
    'client/src/locales/de/translation.json': {
        "title": "Sprint beendet!",
        "subtitle": "Hier ist die Leistung deiner Klasse",
        "accuracy": "Klassengenauigkeit",
        "totalAnswers": "Berechnete Antworten",
        "activeRunners": "Aktive Teilnehmende",
        "insights": "Didaktische Einblicke",
        "hardest": "Übungsbedarf",
        "fastest": "Schnellstes Paar",
        "slowest": "Langsamstes Paar",
        "leaderboard": "Sprint-Podium",
        "correctShort": "FERTIG"
    },
    'client/src/locales/tr/translation.json': {
        "title": "Sprint Tamamlandı!",
        "subtitle": "Sınıf performansınızı gözden geçirin",
        "accuracy": "Sınıf Doğruluğu",
        "totalAnswers": "Hesaplanan Cevaplar",
        "activeRunners": "Aktif Koşucular",
        "insights": "Didaktik İçgörüler",
        "hardest": "Pratik Gerekiyor",
        "fastest": "En Hızlı Çift",
        "slowest": "En Yavaş Çift",
        "leaderboard": "Sprint Podyumu",
        "correctShort": "TAMAM"
    }
}

for path, review_dict in files.items():
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if "classSprint" not in data:
        data["classSprint"] = {}
        
    data["classSprint"]["review"] = review_dict
    
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

print("Injected translations perfectly!")
