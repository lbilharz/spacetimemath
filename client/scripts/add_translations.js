import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const translations = {
  es: {
    register_split: {
      teacher_btn: 'Profesor',
      student_btn: 'Unirse a una clase',
      solo_btn: 'Practicar por mi cuenta',
      email_label: 'Correo electrónico',
      class_code_label: 'Código de clase',
      consent_1: 'Confirmo que soy profesor y utilizo esto con fines escolares.',
      consent_2: 'Doy mi consentimiento para guardar mi correo electrónico para la recuperación de la cuenta.',
      recovery_nag_student: '¡Asegúrate de copiar tu Clave de Recuperación! ¡De lo contrario perderás tu progreso!'
    },
    friends: {
      haveCode: '¿Tienes un código de un amigo?',
      add: 'Agregar',
      adding: 'Agregando...',
      invalidCode: 'Código inválido',
      levelUp: '¡Subir de nivel juntos! 🚀',
      levelUpDesc: 'Jugar es más divertido con amigos. ¡Invita a alguien para ver su progreso en vivo, animalo y compite en las tablas de clasificación!',
      empty: 'Aún no hay amigos',
      inviteActive: 'Invitación activa',
      createInvite: 'Crear enlace de invitación',
      yourLink: 'TU INVITACIÓN',
      inviteHelp: 'El código caduca en 48 horas. Muestra el QR o comparte el código/enlace.',
      remove: 'Eliminar',
      confirm: 'Confirmar',
      score: 'Puntos',
      unknownPlayer: 'Jugador Desconocido'
    },
    nav: {
      friends: 'Amigos'
    }
  },
  fr: {
    register_split: {
      teacher_btn: 'Enseignant',
      student_btn: 'Rejoindre une classe',
      solo_btn: 'S\'entraîner seul',
      email_label: 'Adresse e-mail',
      class_code_label: 'Code de classe',
      consent_1: 'Je confirme être un enseignant et utiliser ceci à des fins scolaires.',
      consent_2: 'Je consens à enregistrer mon e-mail pour la récupération de compte.',
      recovery_nag_student: 'Assurez-vous de copier votre clé de récupération ! Sinon vous perdrez votre progression !'
    },
    friends: {
      haveCode: 'Avez-vous un code d\'ami ?',
      add: 'Ajouter',
      adding: 'Ajout...',
      invalidCode: 'Code invalide',
      levelUp: 'Niveaux ensemble ! 🚀',
      levelUpDesc: 'Jouer est plus amusant avec des amis. Invitez quelqu\'un pour voir sa progression en direct, l\'encourager et faites la course dans les classements !',
      empty: 'Pas encore d\'amis',
      inviteActive: 'Invitation active',
      createInvite: 'Créer un lien d\'invitation',
      yourLink: 'VOTRE INVITATION',
      inviteHelp: 'Le code expire dans 48 heures. Montrez le QR ou partagez le code/lien.',
      remove: 'Supprimer',
      confirm: 'Confirmer',
      score: 'Score',
      unknownPlayer: 'Joueur inconnu'
    },
    nav: {
      friends: 'Amis'
    }
  },
  nl: {
    register_split: {
      teacher_btn: 'Leraar',
      student_btn: 'Deelnemen aan een klas',
      solo_btn: 'Zelf oefenen',
      email_label: 'E-mailadres',
      class_code_label: 'Klascode',
      consent_1: 'Ik bevestig dat ik een leraar ben en dit voor schooldoeleinden gebruik.',
      consent_2: 'Ik geef toestemming om mijn e-mail op te slaan voor accountherstel.',
      recovery_nag_student: 'Zorg ervoor dat u uw herstelsleutel kopieert! Anders verliest u uw voortgang!'
    },
    friends: {
      haveCode: 'Heb je een vriendencode?',
      add: 'Toevoegen',
      adding: 'Toevoegen...',
      invalidCode: 'Ongeldige code',
      levelUp: 'Samen naar een hoger niveau! 🚀',
      levelUpDesc: 'Spelen is leuker met vrienden. Nodig iemand uit om hun live voortgang te zien, moedig ze aan en race tegen ze in het klassement!',
      empty: 'Nog geen vrienden',
      inviteActive: 'Uitnodiging actief',
      createInvite: 'Maak uitnodigingslink',
      yourLink: 'JOUW UITNODIGING',
      inviteHelp: 'Code verloopt over 48 uur. Toon QR of deel code/link.',
      remove: 'Verwijderen',
      confirm: 'Bevestigen',
      score: 'Score',
      unknownPlayer: 'Onbekende Speler'
    },
    nav: {
      friends: 'Vrienden'
    }
  },
  ar: {
    register_split: {
      teacher_btn: 'معلم',
      student_btn: 'الانضمام إلى فصل',
      solo_btn: 'تدرب بمفردك',
      email_label: 'البريد الإلكتروني',
      class_code_label: 'رمز الفصل',
      consent_1: 'أؤكد أنني معلم وأستخدم هذا لأغراض مدرسية.',
      consent_2: 'أوافق على تخزين بريدي الإلكتروني لاسترداد الحساب.',
      recovery_nag_student: 'تأكد من نسخ مفتاح الاسترداد الخاص بك! وإلا ستفقد تقدمك!'
    },
    friends: {
      haveCode: 'هل لديك رمز صديق؟',
      add: 'إضافة',
      adding: 'يتم الإضافة...',
      invalidCode: 'رمز غير صالح',
      levelUp: 'ارتقوا معاً! 🚀',
      levelUpDesc: 'اللعب أكثر متعة مع الأصدقاء. قم بدعوة شخص ما لرؤية تقدمه المباشر، وشجعه، وسابقه على لوحة المتصدرين!',
      empty: 'لا يوجد أصدقاء بعد',
      inviteActive: 'الدعوة نشطة',
      createInvite: 'إنشاء رابط دعوة',
      yourLink: 'دعوتك المميزة',
      inviteHelp: 'ينتهي الرمز خلال 48 ساعة. اعرض رمز الاستجابة أو شارك الرمز/الرابط.',
      remove: 'إزالة',
      confirm: 'تأكيد',
      score: 'النقاط',
      unknownPlayer: 'لاعب غير معروف'
    },
    nav: {
      friends: 'الأصدقاء'
    }
  },
  tr: {
    register_split: {
      teacher_btn: 'Öğretmen',
      student_btn: 'Bir Sınıfa Katıl',
      solo_btn: 'Kendi Başına Pratik Yap',
      email_label: 'E-posta Adresi',
      class_code_label: 'Sınıf Kodu',
      consent_1: 'Öğretmen olduğumu ve bunu okul amaçlı kullandığımı onaylıyorum.',
      consent_2: 'Hesap kurtarma için e-postamın saklanmasını kabul ediyorum.',
      recovery_nag_student: 'Kurtarma Anahtarınızı kopyaladığınızdan emin olun! Aksi takdirde ilerlemenizi kaybedersiniz!'
    },
    friends: {
      haveCode: 'Arkadaşının kodu mu var?',
      add: 'Ekle',
      adding: 'Ekleniyor...',
      invalidCode: 'Geçersiz kod',
      levelUp: 'Birlikte seviye atlayın! 🚀',
      levelUpDesc: 'Oynamak arkadaşlarla daha eğlenceli. Birini canlı ilerlemesini görmek için davet edin, tezahürat yapın ve onlarla liderlik panosunda yarışın!',
      empty: 'Henüz arkadaş yok',
      inviteActive: 'Davet Aktif',
      createInvite: 'Davet Linki Oluştur',
      yourLink: 'SENİN DAVETİYEN',
      inviteHelp: 'Kod 48 saat içinde sona erer. QR göster ya da kod/link paylaş.',
      remove: 'Sil',
      confirm: 'Onayla',
      score: 'Skor',
      unknownPlayer: 'Bilinmeyen Oyuncu'
    },
    nav: {
      friends: 'Arkadaşlar'
    }
  },
  uk: {
    register_split: {
      teacher_btn: 'Вчитель',
      student_btn: 'Приєднатися до класу',
      solo_btn: 'Попрактикуватися самостійно',
      email_label: 'Електронна адреса',
      class_code_label: 'Код класу',
      consent_1: 'Я підтверджую, що є вчителем і використовую це для шкільних цілей.',
      consent_2: 'Я даю згоду на збереження електронної пошти для відновлення облікового запису.',
      recovery_nag_student: 'Обов\'язково скопіюйте ваш ключ відновлення! Інакше ви втратите свій прогрес!'
    },
    friends: {
      haveCode: 'Є код друга?',
      add: 'Додати',
      adding: 'Додавання...',
      invalidCode: 'Недійсний код',
      levelUp: 'Рівні разом! 🚀',
      levelUpDesc: 'Грати веселіше з друзями. Запросіть когось, щоб побачити їх прогрес, підтримайте їх та змагайтеся в таблиці лідерів!',
      empty: 'Ще немає друзів',
      inviteActive: 'Запрошення активне',
      createInvite: 'Створити посилання',
      yourLink: 'ВАШЕ ЗАПРОШЕННЯ',
      inviteHelp: 'Код діє 48 годин. Покажіть QR або поділіться кодом/посиланням.',
      remove: 'Видалити',
      confirm: 'Підтвердити',
      score: 'Рахунок',
      unknownPlayer: 'Невідомий Гравець'
    },
    nav: {
      friends: 'Друзі'
    }
  },
  zh: {
    register_split: {
      teacher_btn: '老师',
      student_btn: '加入班级',
      solo_btn: '自己练习',
      email_label: '电子邮件地址',
      class_code_label: '班级代码',
      consent_1: '我确认我是一名老师并将其用于学校目的。',
      consent_2: '我同意保存我的电子邮件地址以恢复帐户。',
      recovery_nag_student: '确保复制您的恢复密钥！否则您将失去进度！'
    },
    friends: {
      haveCode: '有朋友代码吗？',
      add: '添加',
      adding: '添加中...',
      invalidCode: '无效代码',
      levelUp: '一起升级！🚀',
      levelUpDesc: '和朋友一起玩更有趣。邀请别人实时查看他们的进度，为他们加油并在排行榜上与他们竞争！',
      empty: '还没有朋友',
      inviteActive: '邀请已激活',
      createInvite: '创建邀请链接',
      yourLink: '您的专属邀请',
      inviteHelp: '代码在48小时内过期。出示二维码或分享代码/链接。',
      remove: '移除',
      confirm: '确认',
      score: '分数',
      unknownPlayer: '未知玩家'
    },
    nav: {
      friends: '朋友'
    }
  }
};

const localesPath = path.join(__dirname, '../src/locales');

for (const [lang, obj] of Object.entries(translations)) {
  const file = path.join(localesPath, lang, 'translation.json');
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    data.register_split = { ...data.register_split, ...obj.register_split };
    data.friends = { ...data.friends, ...obj.friends };
    data.nav = { ...data.nav, ...obj.nav };
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\\n');
    console.log(`Updated ${lang}`);
  }
}
