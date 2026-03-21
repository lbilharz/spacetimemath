import os
import json

locales_dir = '/Users/lbi/Projects/lbilharz/spacetimemath/client/src/locales'

translations = {
    'en': { 'regenerateDesc': 'Are you sure? Your old recovery key will be permanently invalidated!', 'regenerateConfirm': 'Confirm & Regenerate' },
    'de': { 'regenerateDesc': 'Bist du sicher? Dein alter Schlüssel wird dauerhaft ungültig!', 'regenerateConfirm': 'Bestätigen & Neu generieren' },
    'fr': { 'regenerateDesc': 'Êtes-vous sûr ? Votre ancienne clé sera définitivement invalidée !', 'regenerateConfirm': 'Confirmer et regénérer' },
    'tr': { 'regenerateDesc': 'Emin misiniz? Eski kurtarma anahtarınız kalıcı olarak geçersiz kılınacak!', 'regenerateConfirm': 'Onayla & Yeniden Oluştur' },
    'nl': { 'regenerateDesc': 'Weet je het zeker? Je oude herstelsleutel wordt permanent ongeldig!', 'regenerateConfirm': 'Bevestigen & Opnieuw genereren' },
    'uk': { 'regenerateDesc': 'Ви впевнені? Ваш старий ключ буде назавжди недійсним!', 'regenerateConfirm': 'Підтвердити та згенерувати' },
    'zh': { 'regenerateDesc': '您确定吗？您的旧恢复密钥将永久失效！', 'regenerateConfirm': '确认并重新生成' },
    'ar': { 'regenerateDesc': 'هل أنت متأكد؟ سيتم إبطال مفتاح الاسترداد القديم الخاص بك بشكل دائم!', 'regenerateConfirm': 'تأكيد وإعادة إنشاء' }
}

for lang, val in translations.items():
    path = os.path.join(locales_dir, lang, 'translation.json')
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if 'account' in data:
            data['account']['regenerateDesc'] = val['regenerateDesc']
            data['account']['regenerateConfirm'] = val['regenerateConfirm']
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')

print("Regeneration Translations updated!")
