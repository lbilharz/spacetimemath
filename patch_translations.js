const fs = require('fs');
const path = require('path');

const translations = {
  ar: {
    common: { viewAll: "عرض الكل" },
    register: { iknowCode: "لدي رمز مكون من 12 رقمًا", codeDesc: "مطبوع على بطاقة الاسترداد الخاصة بك", iknowEmail: "أعرف بريدي الإلكتروني", emailDesc: "تسجيل الدخول عبر الرابط السحري" }
  },
  de: {
    common: { viewAll: "Alle ansehen" },
    register: { iknowCode: "Ich habe einen 12-stelligen Code", codeDesc: "Steht auf deiner Recovery-Karte", iknowEmail: "Ich kenne meine E-Mail", emailDesc: "Login per Magic Link" }
  },
  en: {
    common: { viewAll: "View All" },
    register: { iknowCode: "I have a 12-digit code", codeDesc: "Printed on your recovery card", iknowEmail: "I know my email", emailDesc: "Login via magic link" }
  },
  es: {
    common: { viewAll: "Ver todo" },
    register: { iknowCode: "Tengo un código de 12 dígitos", codeDesc: "Impreso en tu tarjeta de recuperación", iknowEmail: "Conozco mi correo electrónico", emailDesc: "Iniciar sesión por Magic Link" }
  },
  fr: {
    common: { viewAll: "Voir tout" },
    register: { iknowCode: "J'ai un code à 12 chiffres", codeDesc: "Imprimé sur votre carte de récupération", iknowEmail: "Je connais mon email", emailDesc: "Connexion via lien magique" }
  },
  nl: {
    common: { viewAll: "Bekijk alles" },
    register: { iknowCode: "Ik heb een 12-cijferige code", codeDesc: "Gedrukt op je herstelkaart", iknowEmail: "Ik ken mijn e-mail", emailDesc: "Inloggen via mapic link" }
  },
  tr: {
    common: { viewAll: "Hepsini Gör" },
    register: { iknowCode: "12 haneli bir kodum var", codeDesc: "Kurtarma kartınıza basılı", iknowEmail: "E-postamı biliyorum", emailDesc: "Sihirli ipucu ile giriş yapın" }
  },
  uk: {
    common: { viewAll: "Переглянути все" },
    register: { iknowCode: "У мене є 12-значний код", codeDesc: "Надруковано на вашій картці відновлення", iknowEmail: "Я знаю свою електронну пошту", emailDesc: "Увійти за допомогою Magic Link" }
  },
  zh: {
    common: { viewAll: "查看全部" },
    register: { iknowCode: "我有一个 12 位代码", codeDesc: "印在您的恢复卡上", iknowEmail: "我知道我的电子邮件", emailDesc: "通过神奇链接登录" }
  }
};

const localesDir = path.join(__dirname, 'client', 'src', 'locales');
const langs = fs.readdirSync(localesDir);

for (const lang of langs) {
  const filePath = path.join(localesDir, lang, 'translation.json');
  if (fs.existsSync(filePath)) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const t = translations[lang] || translations.en;
    
    if (!data.common) data.common = {};
    if (!data.register) data.register = {};
    
    Object.assign(data.common, t.common);
    Object.assign(data.register, t.register);
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Updated ${lang}`);
  }
}
