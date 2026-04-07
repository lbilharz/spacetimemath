import { getTranslation } from './locales.js';

export function renderEmailTemplate({
  title,
  preheader,
  contentHtml,
  locale = 'en'
}: {
  title: string;
  preheader: string;
  contentHtml: string;
  locale?: string;
}) {
  const dictionary = getTranslation(locale).email;

  const footerText = `${dictionary.operator}<br><br>
       <a href="https://one.up.bilharz.eu/impressum" style="color:#8c8c8c;text-decoration:underline;">${dictionary.impressum}</a> | 
       <a href="https://one.up.bilharz.eu/datenschutz" style="color:#8c8c8c;text-decoration:underline;">${dictionary.privacy}</a>`

  return `
    <!DOCTYPE html>
    <html lang="${locale}">
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#F5F4F0;margin:0;padding:0;">
      <div style="display:none;font-size:1px;color:#F5F4F0;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
        ${preheader}
      </div>
      <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#F5F4F0;">
        <tr>
          <td align="center" style="padding:40px 20px;">
            <div style="max-width:480px;margin:0 auto;text-align:left;">
              
              <!-- Header / Logo -->
              <table border="0" cellspacing="0" cellpadding="0" style="margin-bottom:32px;">
                <tr>
                  <td valign="middle" style="padding-right:12px;">
                    <img src="cid:logo" width="44" height="44" alt="Logo" style="border-radius:10px;display:block;" />
                  </td>
                  <td valign="middle">
                    <span style="font-size:26px;font-weight:800;color:#2C3E50;">Better <span style="color:#FBBA00;">1UP</span></span>
                  </td>
                </tr>
              </table>

              <!-- Main Content -->
              <div style="background-color:#ffffff;border:1px solid #e0dfdb;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.03);">
                ${contentHtml}
              </div>

              <!-- Legal Footer -->
              <div style="margin-top:32px;text-align:center;color:#8c8c8c;font-size:12px;line-height:1.6;">
                ${footerText}
              </div>

            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}
