// ============================================================
// FriendlyBet - Internationalization (i18n)
// ============================================================
// Supports Hebrew (he) and English (en)
// Default language detected by timezone (IL → Hebrew, else English)
// ============================================================

const TRANSLATIONS = {
  he: {
    // === General / Common ===
    'app.name': 'FriendlyBet',
    'openInBrowser.android': 'פתח ב-Chrome כדי להישאר מחובר גם אחרי שתסגור את וואטסאפ.',
    'openInBrowser.ios': 'לחוויה הטובה ביותר פתח ב-Safari (אייקון החץ למעלה), כך תישאר מחובר.',
    'openInBrowser.button': 'פתח ב-Chrome',
    'common.loading': 'טוען...',
    'common.save': 'שמור',
    'common.cancel': 'ביטול',
    'common.delete': 'מחק',
    'common.close': 'סגור',
    'common.back': 'חזור',
    'nav.dashboard': 'חזרה לדשבורד',
    'nav.myPicks': 'הבחירות שלי',
    'common.next': 'הבא',
    'common.confirm': 'אשר',
    'common.yes': 'כן',
    'common.no': 'לא',
    'common.error': 'שגיאה',
    'common.success': 'הצלחה',
    'common.copy': 'העתק',
    'common.share': 'שתף',
    'common.copied': 'הועתק!',
    'common.continue': 'המשך',
    'common.skip': 'דלג',
    'common.create': 'צור',
    'common.add': 'הוסף',
    'common.remove': 'הסר',
    'common.edit': 'ערוך',
    'common.update': 'עדכן',
    'common.send': 'שלח',
    'common.points': 'נק\'',
    'common.bonusPoints': 'נק\' בונוס',
    'common.you': 'אתה',
    'common.admin': 'מארגן',
    'common.adminBadge': 'מארגן ✓',
    'common.day': 'יום',
    'common.days': 'ימים',
    'common.daysUntil': 'ימים עד',
    'common.lastUpdated': 'עודכן',
    'common.allRights': 'כל הזכויות',
    'common.menu': 'תפריט',

    // === Onboarding ===
    'welcome.title': 'FriendlyBet',
    'welcome.subtitle': 'הימור חברים על מונדיאל 2026',
    'welcome.tagline': '100% חינמי · ללא פרסומות · ללא הגבלות',
    'welcome.create': 'צור הימור חדש',
    'welcome.join': 'הצטרף להימור',
    'welcome.recoveryLogin': 'התחברו עם QR או קוד שחזור',
    // v2.5.16: recovery login flow
    'recoveryLogin.title': 'התחברות לחשבון',
    'recoveryLogin.heading': 'סרקו QR או הזינו קוד',
    'recoveryLogin.subtitle': 'בחרו את תמונת ה-QR ששמרתם — או הקלידו את קוד השחזור בן 16 התווים.',
    'recoveryLogin.codeLabel': 'קוד שחזור',
    'recoveryLogin.submit': 'התחבר',
    'recoveryLogin.qrButton': 'התחבר עם ה-QR שלי',
    'recoveryLogin.processing': 'קורא את ה-QR...',
    'recoveryLogin.or': 'או הזן את הקוד ידנית',
    'recoveryLogin.qrNotFound': 'לא זוהה QR בתמונה. נסה תמונה אחרת, או הזן את הקוד ידנית.',
    'recoveryLogin.linkInvalid': 'הקישור פג תוקף או לא תקין. הזן את הקוד ידנית.',
    'recoveryLogin.errorShort': 'הקוד קצר מדי - בדוק שהזנת אותו במלואו',
    'recoveryLogin.errorNotFound': 'קוד לא נמצא. בדוק שהזנת בדיוק את הקוד שקיבלת.',
    'recoveryLogin.errorNoPool': 'ההימור שמשויך לקוד הזה לא נמצא',
    'recoveryLogin.success': 'ברוך שובך, {nickname}!',
    'welcome.noSignup': 'קוד פתוח · ללא איסוף מידע אישי · <a href="https://github.com/Aviatorpo/friendlybet" target="_blank" rel="noopener">GitHub</a>',
    
    'create.title': 'צור הימור חדש',
    'create.poolName': 'שם ההימור',
    'create.poolNamePlaceholder': 'למשל: ההימור של החבר\'ה',
    'create.nickname': 'הכינוי שלך',
    'create.nicknamePlaceholder': 'איך תופיע בלוח הדירוג',
    'create.button': 'צור הימור',
    
    'join.title': 'הצטרף להימור',
    'join.whichPool': 'איזה הימור?',
    'join.enterCode': 'הזן את קוד ההימור שקיבלת',
    'join.alreadyMemberQ': 'כבר הצטרפתם בעבר ויש לכם חשבון?',
    'join.code': 'קוד ההימור',
    'join.codePlaceholder': '5 אותיות, למשל: ABCDE',
    'join.nickname': 'הכינוי שלך',
    'join.nicknamePlaceholder': 'איך תופיע בלוח הדירוג',
    'join.button': 'הצטרף',
    'join.invitedTo': 'הוזמנת ל',
    'join.poolCode': 'קוד',
    'join.findError': 'הקוד לא נמצא. בדוק שוב.',
    'join.poolLocked': 'ההימור נעול',
    'join.poolLockedDesc': 'המארגן נעל את ההימור. לא ניתן להצטרף.',
    
    'recovery.title': 'התחברות עם קוד שחזור',
    'recovery.code': 'הקוד שלך',
    'recovery.codePlaceholder': '16 תווים',
    'recovery.button': 'התחבר',
    
    'recoveryCode.title': 'שמור את קוד השחזור!',
    'recoveryCode.subtitle': 'תזדקק לו כדי להיכנס שוב מטלפון אחר',
    'recoveryCode.warning': 'הקוד הזה לא יוצג שוב. שמור אותו במקום בטוח.',
    'recoveryCode.continue': 'הבנתי, המשך',
    'recoveryCode.copyButton': 'העתק קוד',
    
    // === Dashboard ===
    'dashboard.greeting': 'היי',
    'recoverBracket.title': 'שלב הנוקאאוט שלך לא נשמר',
    'recoverBracket.sub': 'בחירות הבתים שלך נשמרו בהצלחה ✓ אך עקב תקלה טכנית, שלב הנוקאאוט (הבראקט) לא נשמר. אנא מלא אותו מחדש לפני תחילת המונדיאל — מצטערים על אי הנוחות!',
    'recoverBracket.cta': 'מלא את הנוקאאוט',
    'recoverBracket.recovered': 'הבחירות שלך שוחזרו! ✓ בדוק אותן וודא שהכל תקין',
    'dashboard.adminNudge.title': '{n} מחברי הפול צריכים לוודא/להשלים את שלב הנוקאאוט',
    'dashboard.adminNudge.sub': 'מצאנו תקלת שמירה שקטה שפגעה בחלק מהבראקטים — וייתכן שחלק מהחברים פשוט עדיין לא סיימו. בקש מכל המסומנים להיכנס שוב ל-FriendlyBet, לוודא שהבראקט שלהם נשמר ולהשלים אם משהו חסר, לפני תחילת המונדיאל. ההודעה המוכנה מנוסחת בהתאם.',
    'dashboard.adminNudge.view': 'מי הם?',
    'dashboard.tpIncident.title': 'חלק מהבחירות שלך לא נשמרו עקב באג — אנחנו מצטערים',
    'dashboard.tpIncident.sub': 'בעקבות תקלה אצלנו, בחירות הבתים והבראקט בפול הזה לא נשמרו כמו שצריך. תיקנו את הבעיה, ומעכשיו כל בחירה נשמרת ומגובה אוטומטית. נשמח שתמלא/י את הבחירות מחדש — זה ייקח דקה.',
    'dashboard.tpIncident.deadline': 'נתנו לפול שלך זמן נוסף: אפשר למלא מחדש עד {date}.',
    'dashboard.tpIncident.cta': 'מלא/י בחירות מחדש',
    'dashboard.tpIncident.copy': 'העתק הודעת התנצלות לקבוצה',
    'dashboard.tpIncident.copyMessage': 'היי 👋 הייתה תקלה ב-FriendlyBet שגרמה לכך שחלק מהבחירות (בתים ובראקט) לא נשמרו. כבר תוקן — ומעכשיו הכול נשמר ומגובה. בגלל זה קיבלנו זמן נוסף: אפשר למלא מחדש עד {date}. בבקשה היכנסו שוב ומלאו את הבחירות: {link} 🙏⚽',
    'dashboard.tpIncident.copied': 'הודעת ההתנצלות הועתקה — הדבק/י אותה בקבוצה',
    'reopen.notAvailable': 'מילוי מחדש אינו זמין כרגע. פנה למנהל הפול.',
    'reopen.done': 'שלב הנוקאאוט שלך נשמר! ✓',
    'reopen.walkthroughNote': 'סליחה — תיקנו את טבלת השיבוצים הרשמית של FIFA לקבוצות מהמקום השלישי. בחירות הבתים, הקבוצות מהמקום השלישי ומלך השערים נעולות; אפשר לעדכן רק את הנוקאאוט.',
    'reopen.user.preKickoffTitle': 'חשוב: הבראקט שלך דורש תיקון',
    'reopen.user.preKickoffTitlePool': 'חלון בדיקת נוקאאוט נפתח בפול שלך',
    'reopen.user.preKickoffSub': 'סליחה באמת. בגלל טעות שלנו ב-FriendlyBet, חלק מהקבוצות מהמקום השלישי הוצגו במשחקי נוקאאוט לא נכונים. אנא בדוק/י ותקן/י את בחירות הנוקאאוט עכשיו. בחירות שלא יתאימו לבראקט המתוקן עלולות לקבל 0 נקודות.',
    'reopen.user.preKickoffSubHard': 'סליחה באמת. בגלל טעות שלנו ב-FriendlyBet, חלק מהקבוצות מהמקום השלישי הוצגו במשחקי נוקאאוט לא נכונים. הבראקט שלך כולל לפחות בחירה אחת למשחק שכבר לא קיים בבראקט הרשמי המתוקן. אנא בדוק/י ותקן/י את בחירות הנוקאאוט עכשיו. בחירות שלא יתאימו לבראקט המתוקן עלולות לקבל 0 נקודות.',
    'reopen.user.preKickoffSubPool': 'סליחה באמת. תיקנו טעות ב-FriendlyBet שבה חלק מהקבוצות מהמקום השלישי הוצגו במשחקי נוקאאוט לא נכונים. הבראקט שלך לא מסומן כשבור, אבל כי חברים אחרים בפול נפגעו, כולם מקבלים את אותו חלון בדיקה כדי לשמור על הוגנות. אפשר לבדוק את הנוקאאוט מול הבראקט הרשמי המתוקן.',
    'reopen.user.preKickoffCta': 'בדוק את הנוקאאוט עכשיו →',
    'reopen.user.preKickoffPendingTitle': 'חשוב: ייתכן שהנוקאאוט שלך דורש בדיקה',
    'reopen.user.preKickoffPendingSub': 'סליחה באמת — תיקנו שגיאה בשיבוץ קבוצות מהמקום השלישי. אם הבחירות שלך לא יתאימו לבראקט הרשמי המתוקן, הן עלולות לקבל 0 נקודות.',
    'reopen.user.approvedTitle': 'חשוב: הבראקט שלך דורש תיקון',
    'reopen.user.approvedTitlePool': 'חלון בדיקת נוקאאוט נפתח בפול שלך',
    'reopen.user.approvedSub': 'סליחה באמת. בגלל טעות שלנו ב-FriendlyBet, חלק מהקבוצות מהמקום השלישי הוצגו במשחקי נוקאאוט לא נכונים. אנא בדוק/י ותקן/י את בחירות הנוקאאוט עכשיו. בחירות שלא יתאימו לבראקט המתוקן עלולות לקבל 0 נקודות. בחירות הבתים, הקבוצות מהמקום השלישי ומלך השערים נשארות נעולות.',
    'reopen.user.approvedSubHard': 'סליחה באמת. בגלל טעות שלנו ב-FriendlyBet, חלק מהקבוצות מהמקום השלישי הוצגו במשחקי נוקאאוט לא נכונים. הבראקט שלך כולל לפחות בחירה אחת למשחק שכבר לא קיים בבראקט הרשמי המתוקן. אנא בדוק/י ותקן/י את בחירות הנוקאאוט עכשיו. בחירות שלא יתאימו לבראקט המתוקן עלולות לקבל 0 נקודות. בחירות הבתים, הקבוצות מהמקום השלישי ומלך השערים נשארות נעולות.',
    'reopen.user.approvedSubPool': 'סליחה באמת. תיקנו טעות ב-FriendlyBet שבה חלק מהקבוצות מהמקום השלישי הוצגו במשחקי נוקאאוט לא נכונים. הבראקט שלך לא מסומן כשבור, אבל כי חברים אחרים בפול נפגעו, כולם מקבלים את אותו חלון בדיקה כדי לשמור על הוגנות. אפשר לבדוק את הנוקאאוט מול הבראקט הרשמי המתוקן. בחירות הבתים, הקבוצות מהמקום השלישי ומלך השערים נשארות נעולות.',
    'reopen.user.cta': 'תקן את הבראקט →',
    'reopen.user.ctaPool': 'בדוק את הבראקט שלי →',
    'reopen.user.expires': 'פתוח עד {time}',
    'reopen.user.pendingTitle': 'חשוב: ייתכן שהנוקאאוט שלך דורש בדיקה',
    'reopen.user.pendingSub': 'סליחה באמת — תיקנו שגיאה בשיבוץ קבוצות מהמקום השלישי. אם הבחירות שלך לא יתאימו לבראקט הרשמי המתוקן, הן עלולות לקבל 0 נקודות. בקש ממנהל הפול לפתוח לך בדיקת נוקאאוט.',
    'reopen.admin.allowBtn': 'פתח נוקאאוט ל-7 ימים',
    'reopen.admin.extendBtn': 'הוסף 7 ימים',
    'reopen.admin.granted': '✓ מילוי מחדש אופשר',
    'reopen.admin.grantedUntil': '✓ פתוח עד {time}',
    'reopen.admin.copyBtn': 'העתק תזכורת לחבר',
    'reopen.admin.notEligible': 'לא ניתן לאפשר לחבר הזה מילוי מחדש (חסרים נתונים). פנה לתמיכה.',
    'reopen.admin.noCode': 'חסר קוד שחזור בסשן.',
    'reopen.admin.copied': 'ההודעה הועתקה! הדבק אותה לחבר 📋',
    'reopen.admin.personalMsg': 'היי {name}! סליחה, FriendlyBet תיקן טעות שבה חלק מהקבוצות מהמקום השלישי הוצגו במשחקי נוקאאוט לא נכונים. פתחתי לך 7 ימים לבדוק/לתקן רק את הנוקאאוט — בחירות הבתים ומלך השערים נשארות כמו שהיו. היכנס/י ל-friendlybet.live ובדוק/י את הבראקט. תודה.',
    'dashboard.countdown.title': 'המשחק הראשון מתחיל בעוד',
    'dashboard.countdown.live': '🔴 הטורניר התחיל!',
    'dashboard.countdown.days': 'ימים',
    'dashboard.countdown.hours': 'שעות',
    'dashboard.countdown.minutes': 'דקות',
    'dashboard.countdown.seconds': 'שניות',
    'dashboard.liveStatus.kicker': 'חי',
    'dashboard.liveStatus.zeroPoints': '0 נק׳ בינתיים',
    'dashboard.liveStatus.title': 'המונדיאל התחיל - הניקוד עוד מחכה',
    'dashboard.liveStatus.text': 'הניחושים נעולים. נקודות על מיקומים בבית ייכנסו רק כשבית שלם יסיים את כל 6 המשחקים שלו.',
    'dashboard.liveStatus.reviewText': 'חלון בדיקת הנוקאאוט עדיין פתוח עבורך. נקודות על מיקומים בבית ייכנסו רק כשבית שלם יסיים את כל 6 המשחקים שלו.',
    'dashboard.liveStatus.lateKicker': 'פול מאוחר',
    'dashboard.liveStatus.lateDeadline': 'נסגר ב-{time}',
    'dashboard.liveStatus.lateTitle': 'המונדיאל כבר התחיל - ההימורים עדיין פתוחים כאן',
    'dashboard.liveStatus.lateText': 'זה פול שנפתח באיחור. אפשר להזמין חברים ולמלא הימורים עד {time}. אחרי זה ההרשמה והעריכה ייסגרו לכולם.',
    'dashboard.liveStatus.progress': '{done}/{total} משחקי בתים הסתיימו',
    'dashboard.liveStatus.groups': '{done}/{total} בתים הושלמו',
    'pundit.title': 'הפרשן',
    'pundit.badge.confirmed': 'מאומת',
    'pundit.badge.reported': 'מדווח',
    'pundit.badge.pool': 'ההימור שלך',
    'pundit.source': 'מקור:',
    'pundit.seeMore': 'עוד',
    'pundit.seeLess': 'פחות',
    'dashboard.your': 'ההימור שלך',
    'dashboard.points': 'נקודות',
    'dashboard.rank': 'מקום',
    'dashboard.position': 'בלוח',
    'dashboard.poolCode': 'קוד הימור',
    'dashboard.share': 'שתף',
    'dashboard.myRank': 'המקום שלך',
    'dashboard.myBets': 'ההימורים שלי',
    'dashboard.status.groups': 'שלב הבתים',
    'dashboard.status.knockout': 'שלב הנוקאאוט',
    'dashboard.status.topScorer': 'מלך השערים',
    'dashboard.status.notStarted': 'עדיין לא הימרת',
    'dashboard.status.partialGroups': 'הימרת על {n} מתוך 32',
    'dashboard.status.completedGroups': 'הושלם · 32 קבוצות',
    'dashboard.status.afterGroups': 'נפתח אחרי שלב הבתים',
    'dashboard.status.koReady': 'מוכן להמר על 31 משחקים',
    'dashboard.status.partialKo': 'הימרת על {n} מתוך 31',
    'dashboard.status.completedKo': 'הושלם · 31 משחקים',
    'dashboard.status.topScorerLocked': 'נפתח בקרוב',
    'dashboard.action.start': 'התחל',
    'dashboard.action.continue': 'המשך',
    'dashboard.action.edit': 'ערוך',
    'dashboard.invite.title': 'הזמינו חברים — מצטרפים בקליק אחד',
    'dashboard.invite.subtitle': 'שתפו לינק בכל אפליקציה',
    'dashboard.invite.lateTitle': 'הזמינו חברים לפני סגירת ההרשמה',
    'dashboard.invite.lateSubtitle': 'הרשמה והימורים פתוחים עד {time}',
    'dashboard.quickAction.leaderboard': 'דירוג',
    'dashboard.quickAction.help': 'עזרה',
    
    'dashboard.menu.title': 'תפריט',
    'dashboard.role.member': 'משתתף',
    'dashboard.role.adminMember': 'מארגן ומשתתף',
    'dashboard.fallback.nickname': 'משתמש',
    'dashboard.fallback.poolName': 'הימור',
    'dashboard.menu.invite': 'הזמן חברים להימור',
    'dashboard.menu.myInfo': 'המידע שלי',
    'dashboard.menu.showRecovery': 'הצג קוד שחזור',
    'dashboard.menu.members': 'רשימת משתתפים',
    'dashboard.menu.leaderboard': 'לוח דירוגים',
    'dashboard.menu.matches': 'לוח משחקים',
    'dashboard.menu.bracket': 'שלב הנוקאאוט',
    'dashboard.menu.topScorer': 'מלך השערים',
    'dashboard.menu.help': 'עזרה ושאלות נפוצות',
    'dashboard.menu.admin': 'אזור מארגן',
    'dashboard.menu.manageMembers': 'ניהול חברים',
    'dashboard.menu.settings': 'הגדרות ההימור',
    'dashboard.menu.preferences': 'הגדרות',
    'dashboard.menu.language': 'שפה',
    'dashboard.menu.leave': 'התנתק מההימור',
    
    'dashboard.action.groups': 'הימור על בתים',
    'dashboard.action.groups.desc': 'בחר את הקבוצות שיעלו לנוקאאוט',
    'dashboard.action.knockout': 'הימור על נוקאאוט',
    'dashboard.action.knockout.desc': 'נחש מי יעלה מ-32 הקבוצות',
    'dashboard.action.topScorer': 'מלך השערים',
    'dashboard.action.topScorer.desc': 'נחש מי יבקיע הכי הרבה שערים',
    'dashboard.action.simulator': 'סימולטור סיכון',
    'dashboard.action.simulator.desc': 'תכנן אסטרטגיה עם הימור על אנדרדוגים',
    
    'dashboard.poolLocked': 'ההימור נעול - לא ניתן לשנות בחירות',
    'dashboard.poolLockedShort': 'נעול',
    
    // === Group Betting ===
    'groups.title': 'הימור על בתים',
    'groups.group': 'בית',
    'groups.pickInstructions': 'בחר 2 או 3 קבוצות מהבית הזה',
    'groups.advance': 'יעלו לנוקאאוט',
    'groups.tier.favorite': 'פייבוריט',
    'groups.tier.contender': 'מתחרה',
    'groups.tier.underdog': 'אנדרדוג',
    'groups.tier.favorite.multi': '×1',
    'groups.tier.contender.multi': '×1.5',
    'groups.tier.underdog.multi': '×2',
    'groups.minPicks': 'בחר לפחות 2',
    'groups.maxReached': 'כבר בחרת 3 קבוצות. הסר אחת לפני שתוסיף עוד',
    'groups.finishBetting': 'סיים את ההימור',
    'groups.nextGroup': 'בית {letter}',
    'groups.completed': 'השלמת את כל הבתים!',
    'groups.savingPicks': 'שומר...',
    'groups.savedPicks': 'נשמר ✓',
    'groups.picksSaved': 'הבחירות נשמרו',
    'bracketSave.noCode': 'לא הצלחנו לשמור — התחברו מחדש עם קוד השחזור כדי שהבראקט יישמר',
    'bracketSave.retryLater': 'השרת לא זמין כרגע. הבחירות שלכם מגובות וייטענו אוטומטית — רעננו בעוד רגע',

    // === Knockout ===
    'knockout.title': 'הימור על נוקאאוט',
    'knockout.r32': 'סבב 32',
    'knockout.r16': 'שמינית גמר',
    'knockout.qf': 'רבע גמר',
    'knockout.sf': 'חצי גמר',
    'knockout.final': 'גמר',
    'knockout.pickWinner': 'בחר את המנצח',
    'knockout.tbd': 'יעודכן בהמשך',
    // v2.5.79: third-place advancers selector
    'thirdPlace.title': 'איזה 8 שלישיות עולות?',
    'thirdPlace.subtitle': 'במונדיאל 2026 עולות 8 הקבוצות הטובות ביותר שסיימו במקום השלישי. בחר אילו 8 לדעתך יעלו — הן ישובצו אוטומטית לסיבוב ה-32.',
    'thirdPlace.selectExactly': 'בחר בדיוק 8 שלישיות (נבחרו {n})',
    'thirdPlace.maxReached': 'כבר נבחרו 8 — הסר אחת כדי לבחור אחרת',
    'thirdPlace.vs': 'מול',
    'thirdPlace.pointsEach': 'כל ניחוש מדויק = {pts} נקודות',
    
    // === Top Scorer ===
    'topScorer.title': 'מלך השערים',
    'topScorer.heroTitle': 'נחש את מלך השערים',
    'topScorer.heroDesc': 'מי יבקיע הכי הרבה שערים במונדיאל?',
    'topScorer.heroBonus': '+10 נקודות בונוס',
    'topScorer.heroBonusEnd': 'אם תנחש נכון!',
    'topScorer.searchPlaceholder': 'חיפוש שחקן (באנגלית בלבד)...',
    'topScorer.hintsTitle': '💡 דוגמאות לחיפוש:',
    'topScorer.hintsNote': 'ניתן לחפש לפי שם השחקן, חלק מהשם, או קוד הקבוצה (3 אותיות באנגלית)',
    'topScorer.teamSuffix': '(קבוצה)',
    'page.title': 'FriendlyBet · הימור חברים על מונדיאל 2026',
    'page.description': 'הימור חברים על מונדיאל 2026 - חינמי, בלי פרסומות, בלי כסף',
    'topScorer.team': 'קבוצה',
    'topScorer.noResults': 'לא נמצאו שחקנים',
    'topScorer.tryOther': 'נסה לחפש שם אחר',
    'topScorer.yourPick': 'הבחירה שלך:',
    'topScorer.changePick': 'שנה בחירה',
    'topScorer.clearPick': 'נקה בחירה',
    'topScorer.confirmChange': 'להחליף את הבחירה?',
    'topScorer.picked': 'בחרת ב-',
    'topScorer.cleared': 'הבחירה בוטלה',
    'topScorer.star': 'כוכב',
    'topScorer.locked.title': 'מלך השערים יפתח בקרוב',
    'topScorer.locked.desc': 'נחכה לפרסום הסגלים הרשמיים על-ידי FIFA',
    'topScorer.locked.daysUntil': 'ימים עד תחילת המונדיאל',
    'topScorer.locked.lastCheck': 'בדיקה אחרונה',
    
    // === Risk Simulator ===
    'simulator.title': 'סימולטור סיכון',
    'simulator.desc': 'תכנן את האסטרטגיה שלך',
    'simulator.totalBets': 'סה"כ בחירות',
    'simulator.expectedPoints': 'נקודות צפויות',
    'simulator.byTier': 'לפי דרגה:',
    'simulator.recommendation': 'המלצה',
    
    // === Leaderboard ===
    'leaderboard.title': 'לוח דירוגים',
    'leaderboard.rank': 'מקום',
    'leaderboard.player': 'שחקן',
    'leaderboard.points': 'נקודות',
    'leaderboard.groups': 'בתים',
    'leaderboard.knockout': 'נוקאאוט',
    'leaderboard.bonus': 'בונוס',
    'leaderboard.total': 'סה"כ',
    'leaderboard.notStarted': 'עדיין לא הימר',
    'leaderboard.partial': 'הימר על',
    'leaderboard.partialPicks': 'בחירות',
    'leaderboard.complete': 'השלים את הבתים',
    'leaderboard.you': '(אתה)',
    'leaderboard.empty': 'אין משתתפים',
    'leaderboard.joinedToday': 'הצטרף היום',
    'leaderboard.joinedYesterday': 'הצטרף אתמול',
    'leaderboard.joinedDaysAgo': 'הצטרף לפני {n} ימים',
    'leaderboard.joinedOn': 'הצטרף ב-{date}',
    'leaderboard.fullRanking': 'דירוג מלא',
    'leaderboard.emptyTitle': 'הטורניר עוד לא התחיל',
    'leaderboard.emptyText': 'הניקוד יחושב אחרי שיתחילו המשחקים',
    'leaderboard.participantsCount': '{n} משתתפים',
    'leaderboard.statusBefore': 'לפני התחלת הטורניר',
    'leaderboard.statusDuring': 'במהלך הטורניר',
    'leaderboard.podiumEmpty': 'ריק',
    'leaderboard.noPointsYet': 'עדיין בלי נקודות',
    'leaderboard.loadError': 'שגיאה בטעינת הדירוג',
    'leaderboard.shareText': '🏆 לוח הדירוגים של {poolName}!\n\nהצטרף ל-FriendlyBet והתחרה איתנו על מונדיאל 2026:\n{url}',

    // Pool Pundit — live leaderboard banter
    'leaderboard.banter.title': 'פרשן הפול',
    'leaderboard.banter.live': 'חי',
    'leaderboard.banter.share': 'שתף את הרגע',
    'leaderboard.banter.caption': '🎙️ מה קורה ב{pool}? קבלו את הדרמה החיה מהפול שלנו ב-FriendlyBet:',
    'leaderboard.banter.cardTitle': 'מה קורה בפול',
    'leaderboard.banter.cardStandings': 'הצמרת',
    'leaderboard.banter.cardScan': 'סרקו לבראקט',
    'leaderboard.banter.cardTagline': 'חינם · בלי הרשמה · הצטרפו לפול',

    // === Matches ===
    'matches.title': 'לוח משחקים',
    'matches.filter.all': 'הכל',
    'matches.filter.live': 'חי',
    'matches.filter.today': 'היום',
    'matches.filter.upcoming': 'עתידי',
    'matches.empty': 'אין משחקים להצגה',
    'matches.live': 'חי',
    'matches.finished': 'הסתיים',
    'matches.scheduled': 'מתוכנן',
    'matches.matchNum': 'משחק',
    'matches.youPredicted': 'ניחשת:',
    'matches.correctPrediction': 'ניחשת נכון! +{n} נק\'',
    'matches.wrongPrediction': 'לא ניחשת נכון',
    
    // === Bracket ===
    'bracket.title': 'שלב הנוקאאוט',
    'bracket.r16': 'שמינית גמר',
    'bracket.qf': 'רבע גמר',
    'bracket.sf': 'חצי גמר',
    'bracket.final': 'גמר',
    'bracket.champion': 'אלוף',
    
    // === Members ===
    'members.title': 'רשימת משתתפים',
    'members.count': '{n} משתתפים',
    'members.pending': '{n} ממתינים לאישור',
    'members.empty': 'אין משתתפים בהימור',
    
    // === Admin ===
    'admin.title': 'אזור מארגן',
    'admin.members.title': 'ניהול חברים',
    'admin.members.total': 'סה"כ',
    'admin.members.pending': 'ממתינים',
    'admin.members.complete': 'השלימו',
    'admin.members.approve': 'אשר',
    'admin.members.reject': 'הסר',
    'admin.members.pendingBadge': '⏳ ממתין לאישור',
    'admin.members.poolLocked': 'ההימור נעול - לא ניתן לאשר/לדחות',
    'admin.member.actions': 'פעולות',
    'admin.member.generateCode': 'צור קוד שחזור חדש',
    'admin.member.remove': 'הסר מההימור',
    'admin.member.confirmRemove': 'להסיר את {name} מההימור?',
    'admin.member.removed': 'המשתמש הוסר',
    'admin.member.approved': 'המשתמש אושר',
    'admin.member.rejected': 'המשתמש הוסר',
    
    'admin.settings.title': 'הגדרות ההימור',
    'admin.settings.poolStatus': 'מצב ההימור',
    'admin.settings.locked': 'נעול',
    'admin.settings.unlocked': 'פתוח',
    'admin.settings.lockBtn': 'נעל את ההימור',
    'admin.settings.unlockBtn': 'פתח את ההימור',
    'admin.settings.lockDesc': 'כשנעול - אי אפשר לשנות בחירות. אישור חברים חדשים מבוטל.',
    'admin.settings.scoring': 'ניקוד',
    'admin.settings.scoring.groups': 'בית (כל ניחוש נכון)',
    'admin.settings.scoring.r32': 'שמינית גמר',
    'admin.settings.scoring.r16': 'שמינית גמר',
    'admin.settings.scoring.qf': 'רבע גמר',
    'admin.settings.scoring.sf': 'חצי גמר',
    'admin.settings.scoring.final': 'גמר',
    'admin.settings.scoring.topScorer': 'מלך השערים',
    'admin.settings.reset': 'אפס לברירת מחדל',
    'admin.settings.confirmReset': 'לאפס את הניקוד לברירת המחדל?',
    
    // === Sharing / Invite ===
    'invite.title': 'הזמן חברים להימור',
    'invite.desc': 'שתף את הקישור הזה כדי להזמין חברים',
    'invite.code': 'קוד ההימור',
    'invite.link': 'קישור הזמנה',
    'invite.whatsapp': 'WhatsApp',
    'invite.telegram': 'Telegram',
    'invite.qr': 'QR',
    'invite.copy': 'העתק',
    'invite.shareText': 'הצטרף להימור שלי על המונדיאל!',
    
    // === Help ===
    'help.title': 'עזרה ושאלות נפוצות',
    'help.intro': 'FriendlyBet הוא משחק חברתי להימור על המונדיאל',
    
    // === Toasts / Messages ===
    'toast.poolCreated': 'ההימור נוצר בהצלחה!',
    'toast.joined': 'הצטרפת בהצלחה',
    'toast.loginSuccess': 'התחברת בהצלחה',
    'toast.invalidCode': 'קוד שגוי',
    'toast.poolNotFound': 'ההימור לא נמצא',
    'toast.copyError': 'שגיאה בהעתקה',
    'toast.copied': 'הועתק ללוח',
    'toast.recoveryNew': 'קוד שחזור חדש נוצר',
    'toast.offline': 'אתה כרגע במצב לא מקוון',
    'toast.online': 'חזרת למצב מקוון',
    'toast.poolLocked': 'ההימור נעול',
    'toast.poolUnlocked': 'ההימור נפתח',
    'toast.loadError': 'שגיאה בטעינה',
    
    // === Confirmations ===
    'confirm.leave': 'להתנתק מההימור?',
    'confirm.leaveDesc': 'תוכל לחזור בעזרת קוד השחזור.',
    'confirm.alreadyInPool': 'אתה כבר בהימור אחר',
    'confirm.alreadyInPoolDesc': 'כדי להצטרף ל-{name}, עליך להתנתק קודם מההימור הנוכחי.',
    
    // === Dates / Time ===
    'date.today': 'היום',
    'date.tomorrow': 'מחר',
    'date.yesterday': 'אתמול',
    'date.months': ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'],
    'date.monthsShort': ['ינו\'', 'פבר\'', 'מרץ', 'אפר\'', 'מאי', 'יוני', 'יולי', 'אוג\'', 'ספט\'', 'אוק\'', 'נוב\'', 'דצמ\''],
    'date.weekdays': ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'],
    
    // === Country Names ===
    'country.ARG': 'ארגנטינה',
    'country.BRA': 'ברזיל',
    'country.FRA': 'צרפת',
    'country.ENG': 'אנגליה',
    'country.ESP': 'ספרד',
    'country.POR': 'פורטוגל',
    'country.NED': 'הולנד',
    'country.GER': 'גרמניה',
    'country.BEL': 'בלגיה',
    'country.CRO': 'קרואטיה',
    'country.URU': 'אורוגוואי',
    'country.USA': 'ארה"ב',
    'country.MEX': 'מקסיקו',
    'country.SUI': 'שוויץ',
    'country.AUT': 'אוסטריה',
    'country.SWE': 'שבדיה',
    'country.SEN': 'סנגל',
    'country.MAR': 'מרוקו',
    'country.JPN': 'יפן',
    'country.KOR': 'דרום קוריאה',
    'country.AUS': 'אוסטרליה',
    'country.CAN': 'קנדה',
    'country.TUR': 'טורקיה',
    'country.NOR': 'נורווגיה',
    'country.IRN': 'איראן',
    'country.TUN': 'תוניסיה',
    'country.EGY': 'מצרים',
    'country.GHA': 'גאנה',
    'country.PAN': 'פנמה',
    'country.PAR': 'פרגוואי',
    'country.NZL': 'ניו זילנד',
    'country.UZB': 'אוזבקיסטן',
    'country.IRQ': 'עיראק',
    'country.SAU': 'סעודיה',
    'country.JOR': 'ירדן',
    'country.RSA': 'דרום אפריקה',
    'country.ALG': 'אלג\'יריה',
    'country.CZE': 'צ\'כיה',
    'country.HAI': 'האיטי',
    'country.BIH': 'בוסניה',
    'country.CPV': 'כף ורדה',
    'country.COD': 'קונגו',
    'country.CIV': 'חוף השנהב',
    'country.QAT': 'קטאר',
    'country.SCO': 'סקוטלנד',
    'country.CUR': 'קוראסאו',
    'country.ECU': 'אקוודור',
    'country.COL': 'קולומביה',

    // === Feedback / Contact us ===
    'feedback.menuItem': 'שלח משוב',
    'feedback.title': 'שלח לנו משוב',
    'feedback.subtitle': 'נשמח לשמוע מה אפשר לשפר.',
    'feedback.cat.idea': 'רעיון',
    'feedback.cat.bug': 'באג',
    'feedback.cat.praise': 'מחמאה',
    'feedback.cat.other': 'אחר',
    'feedback.placeholder': 'ספר/י לנו מה על הלב...',
    'feedback.emailPlaceholder': 'אימייל לחזרה (לא חובה)',
    'feedback.submit': 'שליחה',
    'feedback.close': 'סגירה',
    'feedback.thanksTitle': 'תודה רבה! 🙌',
    'feedback.thanksText': 'המשוב שלך התקבל ועוזר לנו לשפר.',
    'feedback.emptyError': 'כתוב/כתבי הודעה לפני השליחה',
    'feedback.sendError': 'השליחה נכשלה, נסה/י שוב',

    // === Extended common ===
    'common.tournament': 'טורניר',
    'common.tournamentName': 'מונדיאל 2026',
    'common.status': 'סטטוס',
    'common.matches': 'משחקים',
    'common.members': 'חברים',
    'common.minutes': 'דקות',
    'common.hours': 'שעות',
    'common.justNow': 'הרגע',
    'common.refresh': 'רענן',
    'common.zoom': 'הגדל',
    'common.invite': 'הזמן',
    'common.saveExit': 'שמור וצא',
    'common.simulator': 'סימולטור',
    'common.processing': 'מעבד...',

    // === PWA install banner ===
    'pwa.title': 'התקן את האפליקציה',
    'pwa.text': 'גישה מהירה מהמסך הראשי, ללא דפדפן',
    'pwa.install': 'התקן',
    'pwa.installed': '🎉 האפליקציה הותקנה!',
    'pwa.installing': '🎉 מתקין...',
    'pwa.iosInstructions': 'להתקנת האפליקציה ב-iPhone/iPad:\n\n1. לחץ על כפתור השיתוף ⎙ למטה\n2. גלול ובחר "הוסף למסך הבית"\n3. לחץ "הוסף"\n\nהאפליקציה תופיע במסך הבית כמו אפליקציה רגילה!',
    'pwa.desktopInstructions': 'להתקנת האפליקציה:\n\n• Chrome/Edge: יופיע כפתור "התקן" בשורת הכתובת\n• Firefox: לחץ על שלוש הנקודות → "התקן"\n• או הוסף לסימניות',
    'pwa.updateAvailable': '🔄 גרסה חדשה זמינה',
    'pwa.update': 'עדכן',
    'pwa.online': '🌐 מחובר לאינטרנט',
    'pwa.offline': 'אין חיבור לאינטרנט - חלק מהפיצ\'רים מוגבלים',

    // === Pool found screen ===
    'poolFound.title': 'פרטי ההימור',
    'poolFound.membersValue': '{n} חברים',
    'poolFound.statusOpen': 'פתוח להצטרפות',
    'poolFound.statusLateOpen': 'פתוח להצטרפות עד {time}',
    'poolFound.statusGroupLocked': 'שלב הבתים סגור',
    'poolFound.statusKnockout': 'בשלב הנוקאאוט',
    'poolFound.statusFinished': 'הסתיים',

    // === Nickname screen ===
    'nickname.step': 'שלב 1 מתוך 2',
    'nickname.title': 'איך נקרא לך?',
    'nickname.subtitle': 'הכינוי יוצג בלוח הדירוגים',
    'nickname.placeholder': 'לדוגמה: דני',
    'nickname.checking': 'בודק זמינות...',
    'nickname.taken': 'הכינוי תפוס, נסה אחר',
    'nickname.available': 'הכינוי פנוי!',
    'nickname.errorRequired': 'נא להזין כינוי',
    'nickname.errorMin': 'הכינוי חייב להיות לפחות {n} תווים',
    'nickname.errorMax': 'הכינוי לא יכול לחרוג מ-{n} תווים',
    'nickname.errorTaken': 'הכינוי כבר תפוס בהימור הזה',

    // === Recovery code creation ===
    'recoveryCode.step': 'שלב 2 מתוך 2',
    'recoveryCode.sendSelf': 'שלח לעצמי',
    'recoveryCode.warningTitle': 'חשוב!',
    'recoveryCode.warningText': 'ללא הקוד הזה לא תוכל להתחבר חזרה. שמור אותו במקום בטוח.',
    'recoveryCode.saved': 'שמרתי, המשך',
    'recoveryCode.shareText': '🔑 קוד השחזור שלי ל-{poolName}:\n\n{code}\n\n⚠️ שמור הודעה זו - תזדקק לקוד אם תרצה להתחבר מחדש!\n\n{url}',
    'recoveryCode.copiedSave': 'קוד השחזור הועתק! שמור אותו במקום בטוח',
    'recoveryCode.copied': 'קוד השחזור הועתק!',

    // === Create pool ===
    'createPool.step1': 'שלב 1 מתוך 3',
    'createPool.title1': 'איך נקרא להימור?',
    'createPool.subtitle1': 'השם שיוצג לכל המשתתפים',
    'createPool.placeholder': 'לדוגמה: חברים מהעבודה',
    'createPool.suggestions': 'הצעות מהירות:',
    'createPool.suggestion1': 'חברים מהעבודה',
    'createPool.suggestion2': 'המשפחה',
    'createPool.suggestion3': 'חברים מהצבא',
    'createPool.suggestion4': 'השכונה',
    'createPool.suggestion5': 'התיכון',
    'createPool.suggestion6': 'מילואים',
    'createPool.suggestion7': 'קבוצת הוואטסאפ',
    'createPool.suggestion8': 'האוניברסיטה',
    'createPool.suggestion9': 'האנדרדוגים',
    'createPool.suggestion10': 'הגאונים של מונדיאל 2026',
    'createPool.errorRequired': 'נא להזין שם להימור',
    'createPool.errorMin': 'השם חייב להיות לפחות {n} תווים',

    // === Admin nickname ===
    'adminNickname.step': 'שלב 2 מתוך 3',
    'adminNickname.subtitle': 'הכינוי שלך כמארגן וגם כמשתתף',
    'adminNickname.placeholder': 'לדוגמה: יוסי',
    'adminNickname.permTitle': 'הרשאות המארגן',
    'adminNickname.perm1': 'ניהול חברי ההימור',
    'adminNickname.permRules': 'קביעת חוקי ההימור',
    'adminNickname.perm2': 'אישור משתמשים חדשים',
    'adminNickname.perm3': 'שחזור קודים אבודים',
    'adminNickname.perm4': 'צפייה בכל ההימורים',
    'adminNickname.perm5': 'אתה גם משתתף בהימור',
    'adminNickname.errorRequired': 'נא להזין את הכינוי שלך',
    'adminNickname.createBtn': 'צור הימור',

    // === Share pool ===
    'sharePool.created': 'ההימור נוצר!',
    'sharePool.awesome': 'מעולה!',
    'sharePool.subtitle': 'ההימור נוצר בהצלחה',
    'sharePool.promptTitle': 'ההימור נוצר עם חוקי ברירת מחדל',
    'sharePool.promptSubtitle': 'תוכל לערוך את כל החוקים לפני שמישהו מצטרף',
    'sharePool.editSettings': 'ערוך הגדרות',
    'sharePool.divider': 'או פשוט שתף ותתחיל לשחק',
    'sharePool.whatsapp': 'שתף ב-WhatsApp',
    'sharePool.telegram': 'שתף ב-Telegram',
    'sharePool.copyLink': 'העתק קישור',
    'sharePool.toDashboard': 'לדשבורד שלי',
    'sharePool.welcomeToast': 'ברוך הבא ל-{name}!',
    'sharePool.adminCodeAlert': '🔑 קוד השחזור שלך כמארגן:\n\n{code}\n\nשמור אותו במקום בטוח! בלעדיו לא תוכל להתחבר חזרה.',
    'sharePool.shareText': 'הוזמנת להצטרף להימור "{poolName}" 🏆\n\nבואו ננחש ביחד את מונדיאל 2026 — חינם לגמרי, בלי פרסומות, בלי מגבלות.\n\nקוד הצטרפות: {code}\n👉 {url}\n\n⚽ FriendlyBet — הימור חברים על מונדיאל 2026',
    'sharePool.shareTextLate': 'הוזמנת להצטרף לפול מאוחר "{poolName}" 🏆\n\nהמונדיאל כבר התחיל, אבל בפול הזה עדיין אפשר להצטרף ולמלא הימורים עד {time}.\n\nקוד הצטרפות: {code}\n👉 {url}\n\n⚽ FriendlyBet — הימור חברים על מונדיאל 2026',
    'bracketShare.cta': 'שתף את הבראקט שלי',
    'bracketShare.caption': 'הבראקט שלי למונדיאל 2026 ב-FriendlyBet 🏆 חינם, בלי הרשמה — בנו בראקט משלכם',
    'bracketShare.toastDesktop': 'התמונה הורדה והטקסט הועתק — העלו אותה לרשת החברתית',
    'bracketShare.notReady': 'סיימו קודם את הבראקט (כולל האלופה) כדי לשתף',
    'bracketShare.celebrateTitle': '🏆 הבראקט שלך נשמר!',
    'bracketShare.done': 'סיום — לדשבורד',
    'bracketShare.orChoose': 'או שתפו דרך אפליקציה',
    'bracketShare.shareToApps': 'משתפים לכל אפליקציה',
    'bracketShare.desktopTitle': 'שתפו את הבראקט שלכם',
    'bracketShare.desktopSub': 'העתיקו לינק או בחרו אפליקציה — מי שיפתח יראה את הבראקט המלא',
    'bracketShare.imageFirstHint': 'הורדנו את התמונה — צרפו אותה לפוסט (גם הלינק הועתק)',
    'bracketShare.copyLink': 'העתק לינק',
    'bracketShare.linkCopied': 'הלינק הועתק! 🔗',
    'bracketShare.downloadImage': 'הורד תמונה',
    'bracketShare.redditTitle': 'הבראקט שלי למונדיאל 2026 🏆',
    'bracketShare.emailSubject': 'הבראקט שלי למונדיאל 2026 ב-FriendlyBet',
    'bracketShare.igHint': 'התמונה הורדה — פתחו אינסטגרם והעלו אותה לסטורי',

    // === Pool settings ===
    'poolSettings.lockedTitle': 'החוקים נעולים',
    'poolSettings.lockedText': 'משתתפים כבר הצטרפו - לא ניתן לשנות חוקים',
    'poolSettings.poolInfo': 'פרטי ההימור',
    // v2.5.7: v2 (single_phase) pool settings sections
    'poolSettings.bettingMode': 'שיטת ההימור',
    'poolSettings.bettingModeLabel': 'מצב',
    'poolSettings.bettingModeHelp': 'הימור חד-שלבי: בתים + נוקאאוט + מלך שערים, הכל לפני תחילת הטורניר.',
    'poolSettings.scoringReadOnly': 'חוקי הניקוד נקבעו ביצירת ההימור ולא ניתנים לשינוי.',
    'poolSettings.poolName': 'שם ההימור',
    'poolSettings.poolCode': 'קוד ההימור',
    'poolSettings.poolMembers': 'משתתפים',
    'poolSettings.format': 'מבנה ההימור',
    'poolSettings.stages': 'מספר שלבי הימור',
    'poolSettings.stages2': '2 שלבים',
    'poolSettings.stages6': '6 שלבים',
    'poolSettings.help2': '2 שלבים: בתים + נוקאאוט',
    'poolSettings.help6': '6 שלבים: בתים + R32 + R16 + רבע + חצי + גמר',
    'poolSettings.groupBetting': 'איך מהמרים על בתים',
    'poolSettings.pickAdvancing': 'בחירת עולות',
    'poolSettings.fullRanking': 'דירוג 1-4',
    'poolSettings.helpPickAdvancing': 'בחירת 2-3 קבוצות שיעלו מכל בית',
    'poolSettings.helpFullRanking': 'דירוג מלא של כל הקבוצות בבית',
    'poolSettings.multipliers': 'מכפילי סיכון',
    'poolSettings.multipliersActive': 'מכפילים פעילים',
    'poolSettings.multipliersHelp': 'מי שמסתכן יותר — מרוויח יותר 🎲',
    'poolSettings.multFav': 'פייבוריטית',
    'poolSettings.multCont': 'מתמודדת',
    'poolSettings.multUnd': 'אנדרדוג',
    'poolSettings.scoring': 'ניקוד לכל שלב',
    'poolSettings.scoreGroupStage': 'שלב הבתים',
    'poolSettings.scoreR32': 'סבב 32',
    'poolSettings.scoreR16': 'שמינית גמר',
    'poolSettings.scoreQF': 'רבע גמר',
    'poolSettings.scoreSF': 'חצי גמר',
    'poolSettings.scoreFinal': 'גמר',
    'poolSettings.resetGolazo': 'איפוס לחוקי ברירת מחדל',
    'poolSettings.topScorer': 'מלך השערים',
    'poolSettings.topScorerActive': 'פעיל',
    'poolSettings.bonusPoints': 'בונוס נקודות',
    'poolSettings.members': 'משתתפים',
    'poolSettings.limitMembers': 'הגבלת משתתפים',
    'poolSettings.maxMembers': 'מקסימום משתתפים',
    'poolSettings.approveBefore': 'אישור משתמשים לפני הימור',
    'poolSettings.approveBeforeHelp': 'הגנה מבוטים - תאשר כל משתתף ידנית לפני שיוכל להמר',
    'poolSettings.saveBtn': 'שמור הגדרות',
    'poolSettings.dangerZone': 'אזור מסוכן',
    'poolSettings.deletePool': 'מחק את ההימור',
    'poolSettings.deleteHelp': 'מחיקה היא פעולה לא הפיכה. כל הנתונים יימחקו לצמיתות.',
    'poolSettings.savingToast': 'שומר הגדרות...',
    'poolSettings.savedToast': 'ההגדרות נשמרו בהצלחה! ✅',
    'poolSettings.saveError': 'שגיאה בשמירה: {msg}',
    'poolSettings.poolNameShort': 'שם ההימור קצר מדי',
    'poolSettings.notAdmin': 'רק המארגן יכול לערוך הגדרות',
    'poolSettings.loadError': 'שגיאה בטעינת ההגדרות',
    'poolSettings.notFound': 'לא נמצא הימור',
    'poolSettings.resetToast': 'הוחזר לחוקים המקוריים',
    'poolSettings.bonusToast': 'בונוס מלך השערים: {n} נקודות',
    'poolSettings.deleteWarning': '⚠️ אזהרה!\n\nאתה עומד למחוק את ההימור "{name}".\n\nכל הנתונים, ההימורים והניקוד יימחקו לצמיתות.\n\nפעולה זו לא ניתנת לביטול.\n\nהאם להמשיך?',
    'poolSettings.deletePrompt': 'כדי לאשר, הקלד את שם ההימור:\n"{name}"',
    'poolSettings.deleteCancelled': 'המחיקה בוטלה',
    'poolSettings.deleteError': 'שגיאה במחיקה: {msg}',
    'poolSettings.deletedToast': 'ההימור נמחק',
    'poolSettings.leaveConfirm': 'האם להתנתק מההימור?\n\nהקוד שלך עדיין יעבוד - תוכל להתחבר שוב עם קוד השחזור.',
    'poolSettings.leftToast': 'התנתקת מההימור',

    // === Group betting ===
    'groups.titleGroup': 'בית {letter}',
    'groups.stepProgress': 'בית {current} מתוך {total}',
    'groups.totalPicks': 'סך הכל הימרת על',
    'groups.questionHeader': 'על מי תהמר בבית',
    'groups.subtitleInline': 'בחר 2 או 3 קבוצות שיעלו לשלב הבא',
    'groups.quickJump': 'קפיצה מהירה לבית',
    'groups.prevGroup': 'בית {letter}',
    'groups.nextGroup': 'בית {letter}',
    'groups.saveAndNext': 'שמור ועבור לבית הבא',
    'groups.tierFavorite': '⭐ פייבוריטית ×1',
    'groups.tierContender': '⚔️ מתמודדת ×1.5',
    'groups.tierUnderdog': '🐶 אנדרדוג ×2',
    'groups.pointsForPosition': '#{pos}: {pts} נק׳',
    'groups.multStartsKO': 'מכפילי הסיכון מתחילים להשפיע משלב הנוקאאוט',
    'groups.pointsPerAdvancingTeam': 'כל קבוצה שעולה: {pts} נק׳ × מכפיל הסיכון שלה',
    'groups.tooltipAdvanced': 'הקבוצה עלתה!',
    'groups.tooltipEliminated': 'הקבוצה הודחה',
    'groups.maxReachedToast': 'כבר בחרת 3 קבוצות. הסר אחת לפני שתוסיף עוד',
    'groups.maxTotalReached': 'בחרת כבר 32 נבחרות שעולות — המקסימום. הסר אחת לפני שתוסיף עוד',
    'groups.pickSubtitleDefault': 'בחר 2 או 3 קבוצות מהבית הזה',
    'groups.pickOneOnly': '⚠️ בחרת רק קבוצה אחת - צריך 2 או 3',
    'groups.pickedTwo': '✓ בחרת 2 קבוצות בבית הזה',
    'groups.pickedThree': '✓ בחרת 3 קבוצות בבית הזה',
    'groups.validationRemaining': 'נשאר עוד {n} קבוצות לבחור',
    'groups.validationDone': '🎉 הושלם! 32 קבוצות נבחרו',
    'groups.validationProblem': 'בעיה: לפחות בית אחד עם 0 או 1 קבוצות בלבד',
    'groups.validationTooMany': 'יותר מדי! {n} קבוצות מעל המקסימום',
    'groups.needMore': 'בחר עוד {n} קבוצ{plural} כדי להמשיך',
    'groups.mustPickTwo': 'חייב לבחור לפחות 2 קבוצות בבית {letter} כדי להמשיך',
    'groups.saveError': 'שגיאה בשמירת ההימור',
    'groups.savedOk': 'ההימור נשמר ✓',
    'groups.exitConfirm': 'יש לך {n} הימורים שמורים. צא מבלי לסיים?',
    'groups.exactly32': 'צריך בדיוק 32 קבוצות (יש {n})',
    'groups.eachGroup2or3': 'בכל בית חייבים להיות 2 או 3 קבוצות',
    'groups.savingToast': 'שומר הימור...',
    'groups.loadingTeams': 'טוען את הקבוצות...',
    'groups.teamsSyncing': 'הקבוצות עדיין בסנכרון - נסה שוב בעוד מספר דקות',

    // === Betting complete ===
    'complete.title': 'כל הכבוד!',
    'complete.subtitle': 'השלמת את ההימור על שלב הבתים',
    'complete.teamsPicked': 'קבוצות שבחרת',
    'complete.maxPoints': 'סיכוי לניקוד מקסימלי',
    'complete.info': 'ההימור נשמר. תוכל לערוך אותו עד לפני המשחק הראשון',
    'complete.toDashboard': 'לדשבורד שלי',
    'complete.review': 'סקור את ההימורים שלי',

    // === Knockout extras ===
    'knockoutEx.r32Short': 'סבב 32',
    'knockoutEx.r16Short': 'שמינית',
    'knockoutEx.qfShort': 'רבע',
    'knockoutEx.sfShort': 'חצי',
    'knockoutEx.finalShort': 'גמר',
    'knockoutEx.r32Full': 'סבב 32',
    'knockoutEx.r16Full': 'שמינית הגמר',
    'knockoutEx.qfFull': 'רבע הגמר',
    'knockoutEx.sfFull': 'חצי הגמר',
    'knockoutEx.finalFull': 'הגמר',
    'knockoutEx.pointsPerPick': '{n} נקודות לכל ניחוש נכון',
    'knockoutEx.totalPicks': 'סה"כ הימרת על',
    'knockoutEx.emptyTitle': 'הסבב הזה ייפתח בהמשך',
    'knockoutEx.emptyText': 'קודם השלם את הסבבים הקודמים',
    'knockoutEx.finishBtn': 'סיים את הימור הנוקאאוט',
    'knockoutEx.bracketView': 'תצוגת ההגרלה',
    'knockoutEx.matchNum': 'משחק {n}',
    'knockoutEx.finalLabel': 'הגמר 🏆',
    'knockoutEx.winnerLine': 'המנצח: <strong>אלוף המונדיאל!</strong>',
    'knockoutEx.correctLine': 'ניחשת נכון! +{n} נק\'',
    'knockoutEx.wonLine': '{name} ניצח',
    'knockoutEx.opponent': 'היריב',
    'knockoutEx.equalizer': 'משווה',
    'knockoutEx.pointsValue': '{n} נק\'',
    'knockoutEx.ifCorrect': 'אם תנחש נכון',
    'knockoutEx.tbdTeam': 'להיקבע',
    'knockoutEx.savedOk': 'הימור הנוקאאוט נשמר ✓',
    'knockoutEx.completed': 'הימור הנוקאאוט הושלם! 🏆',
    'knockoutEx.needGroups': 'צריך לסיים קודם את שלב הבתים (32 קבוצות)',
    'knockoutEx.loadingKO': 'טוען את שלב הנוקאאוט...',
    'knockoutEx.loadError': 'שגיאה בטעינת הקבוצות',
    'knockoutEx.matchesProgress': '{n}/31 משחקים',

    // === Bracket view ===
    'bracketView.title': 'עץ ההגרלה',
    'bracketView.full': 'תצוגה מלאה',
    'bracketView.leftSide': 'חצי שמאל',
    'bracketView.rightSide': 'חצי ימין',
    'bracketView.scrollHint': '↔ גלול הצידה כדי לראות את שני הצדדים',
    'bracketView.scrollChip': '↔ גלול לצדדים',
    'bracketView.hint': 'גרור עם האצבע כדי לראות את כל הסבבים',
    'bracketView.r32': 'R32',
    'bracketView.r16': 'שמינית',
    'bracketView.qf': 'רבע',
    'bracketView.sf': 'חצי',
    'bracketView.final': '🏆 גמר',
    'bracketView.championLabel': '🏆 אלוף 🏆',
    'bracketView.tbd': 'להיקבע',

    // === Simulator ===
    'simulatorEx.titleFull': 'סימולטור הסיכון',
    'simulatorEx.subtitle': 'ניתוח אסטרטגיית ההימור שלך',
    'simulatorEx.expectedScore': 'ניקוד צפוי',
    'simulatorEx.avgProjection': 'צפי ממוצע',
    'simulatorEx.maxPossible': 'מקסימום אפשרי',
    'simulatorEx.riskLevel': 'רמת סיכון',
    'simulatorEx.riskSafe': '🛡️ בטוח',
    'simulatorEx.riskBalanced': '⚡ מאוזן',
    'simulatorEx.riskRisky': '🎲 מסוכן',
    'simulatorEx.riskDefault': 'בחר משחקים כדי לראות ניתוח',
    'simulatorEx.byStage': 'פירוט לפי שלב',
    'simulatorEx.recommendDefault': 'בחר משחקים בנוקאאוט כדי לקבל המלצות',
    'simulatorEx.riskDescSafe': '🛡️ אסטרטגיה בטוחה - אתה מהמר על הפייבוריטיות',
    'simulatorEx.riskDescBalanced': '⚡ אסטרטגיה מאוזנת - שילוב של בטוח ויצירתי',
    'simulatorEx.riskDescRisky': '🎲 אסטרטגיה אגרסיבית - הרבה הימורים מסוכנים',
    'simulatorEx.riskDescVery': '🔥 אסטרטגיה ספורטיבית - הולך על הכל!',
    'simulatorEx.recEarly': 'התחל לבחור משחקים והסימולטור ינתח את האסטרטגיה שלך',
    'simulatorEx.recContinue': 'המשך לבחור כדי לראות תמונה מלאה של הסיכויים שלך',
    'simulatorEx.recTooSafe': 'אסטרטגיה בטוחה תיתן צפי ניקוד יציב, אבל קשה לעקוף יריבים שיסתכנו ויצליחו. נסה להוסיף 1-2 הימורים נועזים יותר.',
    'simulatorEx.recTooRisky': 'אסטרטגיה מסוכנת מאוד! פוטנציאל ענק לניקוד גבוה, אבל סיכוי גבוה לטעויות. שקול לחזור לבטוח ב-1-2 שלבים מאוחרים.',
    'simulatorEx.recBalanced': 'איזון מצוין! יש לך פוטנציאל לניקוד גבוה עם סיכון מתון. זאת אסטרטגיה חכמה.',

    // === Matches extras ===
    'matchesEx.filterUpcoming': 'קרובים',
    'matchesEx.filterFinished': 'הסתיימו',
    'matchesEx.filterLive': '🔴 חי',
    'matchesEx.live': 'משחק חי',
    'matchesEx.liveUpdating': 'התוצאה החיה מתעדכנת',
    'matchesEx.finished': 'הסתיים',
    'matchesEx.scoreAfterFinal': 'התוצאה תתעדכן בסיום המשחק',
    'matchesEx.verifyingResult': 'מאמתים תוצאה',
    'matchesEx.resultBeingVerified': 'התוצאה הסופית מתעדכנת עכשיו',
    // v2.5.37: live minute labels (client-computed from match_date)
    'matchesEx.minute': "דקה {n}'",
    'matchesEx.halftime': 'הפסקת מחצית',
    'matchesEx.extraTime': "תוספת זמן · דקה {n}'",
    'matchesEx.lastUpdated': 'עודכן: {time}',
    'matchesEx.notSynced': 'עוד לא סונכרן',
    'matchesEx.emptyTitle': 'המשחקים עוד לא פורסמו',
    'matchesEx.emptyText': 'לוח המשחקים יתעדכן ברגע שפיפ"א תפרסם את ה-Draw הרשמי',
    'matchesEx.loadingMatches': 'טוען משחקים...',
    'matchesEx.noInCategory': 'אין משחקים בקטגוריה הזאת',
    'matchesEx.dateUnknown': 'תאריך לא ידוע',
    'matchesEx.past': 'עבר',
    'matchesEx.inMinutes': 'בעוד {n} דקות',
    'matchesEx.inHours': 'בעוד {n} שעות',
    'matchesEx.inDays': 'בעוד {n} ימים',
    'matchesEx.minutesAgo': 'לפני {n} דקות',
    'matchesEx.hoursAgo': 'לפני {n} שעות',
    'matchesEx.daysAgo': 'לפני {n} ימים',
    'matchesEx.syncing': 'מסנכרן משחקים...',
    'matchesEx.synced': 'עודכן ✓',
    'matchesEx.loadError': 'שגיאה בטעינת המשחקים',
    'matchesEx.stageGroup': 'בית {letter}',
    'matchesEx.stageR16': 'שמינית הגמר',
    'matchesEx.stageQF': 'רבע הגמר',
    'matchesEx.stageSF': 'חצי הגמר',
    'matchesEx.stageFinal': '🏆 הגמר',
    'matchesEx.stageThird': 'מקום 3',

    // === Admin members ===
    'adminMembersEx.lockedTitle': 'ההימור נעול',
    'adminMembersEx.lockedText': 'אין אפשרות להצטרף עם קוד ההזמנה',
    'adminMembersEx.unlockBtn': 'בטל נעילה',
    'adminMembersEx.openTitle': 'ההימור פתוח להצטרפות',
    'adminMembersEx.openText': 'חברים חדשים יכולים להצטרף עם קוד ההזמנה',
    'adminMembersEx.lockBtn': 'נעל',
    'adminMembersEx.notAdmin': '🚫 רק המארגן יכול לגשת לאזור הזה',
    'adminMembersEx.notAdminAction': '🚫 רק המארגן יכול לעשות זאת',
    'adminMembersEx.pendingCount': 'יש <span id="admin-pending-count">{n}</span> חברים שממתינים לאישור',
    'adminMembersEx.pendingSubtitle': 'הם יכולים לשחק - אבל מומלץ לאשר/להסיר אותם',
    'adminMembersEx.members': 'חברים',
    'adminMembersEx.pickedGroups': 'בחרו בתים',
    'adminMembersEx.pickedKO': 'בחרו נוקאאוט',
    'adminMembersEx.adminBadge': 'מארגן ✓',
    'adminMembersEx.pendingBadge': '⏳ ממתין לאישור',
    'adminMembersEx.approve': 'אשר',
    'adminMembersEx.remove': 'הסר',
    'adminMembersEx.groupsPicks': 'בתים: {n} {check}',
    'adminMembersEx.koPicks': 'נוקאאוט: {n}/16 {check}',
    'adminMembersEx.startedYes': '✓ התחיל להמר',
    'adminMembersEx.startedNo': '○ טרם התחיל',
    'adminMembersEx.finishedYes': '✓ סיים הכל',
    'adminMembersEx.finishedNo': '○ טרם סיים',
    'adminMembersEx.needsKnockout': 'חסר נוקאאוט',
    'adminMembersEx.annexReview': 'צריך לבדוק נוקאאוט',
    'adminMembersEx.annexHardAffected': 'חייב לתקן נוקאאוט',
    'adminMembersEx.annexNoIssue': 'לא צריך תיקון',
    'adminMembersEx.needsKnockoutCount': '{n} חברים עדיין לא מילאו את שלב הנוקאאוט — שווה לנדנד להם להשלים לפני תחילת המונדיאל',
    'adminMembersEx.needsKnockoutGlitch': '{n} משתתפים צריכים להשלים או לוודא את שלב הנוקאאוט. חלקם אולי נפגעו מתקלת שמירה שקטה, וחלקם אולי פשוט עדיין לא סיימו. הם מסומנים למטה.',
    'adminMembersEx.annexCReviewTitle': 'חשוב: הפול שלך צריך לבדוק את הנוקאאוט',
    'adminMembersEx.annexCReviewGlitch': 'סליחה באמת. FriendlyBet הציג בפול הזה חלק מהקבוצות מהמקום השלישי במשחקי נוקאאוט לא נכונים. {hard} משתתפים מסומנים כנפגעים ישירות כי יש להם לפחות בחירה אחת למשחק שכבר לא קיים בבראקט המתוקן. כדי לשמור על הוגנות, לכל {n} המשתתפים בפול נפתח חלון בדיקה ועדכון לבראקט הנוקאאוט. בחירות שלא יתאימו לבראקט הרשמי המתוקן עלולות לקבל 0 נקודות.',
    'adminMembersEx.annexReviewExpires': 'חלון הבדיקה פתוח עד {time} לפי הזמן המקומי של כל משתמש',
    'adminMembersEx.annexYouHard': 'גם בבראקט שלך יש בחירות שחייבים לתקן — כדאי לבדוק אותו עכשיו.',
    'adminMembersEx.annexYouReview': 'גם לך יש חלון תיקון — כדאי לבדוק את הבראקט שלך.',
    'adminMembersEx.annexYouClear': 'הבראקט שלך לא מסומן כנפגע ישירות, אבל יש משתתפים בפול שצריכים תזכורת.',
    'adminMembersEx.copyNudge': 'העתק תזכורת לחברים',
    'adminMembersEx.viewAffectedMembers': 'ראה משתתפים',
    'adminMembersEx.reviewMyBracket': 'בדוק את הבראקט שלי',
    'adminMembersEx.nudgeMessage': 'היי לכולם, סליחה באמת. FriendlyBet תיקן טעות שבה חלק מהקבוצות מהמקום השלישי הוצגו במשחקי נוקאאוט לא נכונים. בגלל זה חלק מבחירות הנוקאאוט עלולות להצביע למשחקים שכבר לא קיימים בבראקט הרשמי המתוקן, והבחירות האלה עלולות לקבל 0 נקודות. בבקשה היכנסו עכשיו ל-friendlybet.live ובדקו או תקנו את הבראקט. בחירות הבתים, הקבוצות מהמקום השלישי ומלך השערים נשארות נעולות; רק הנוקאאוט פתוח בחלון הבדיקה. תודה וסליחה על הטרחה.',
    'adminMembersEx.nudgeCopied': 'ההודעה הועתקה! הדביקו אותה בקבוצה 📋',
    'adminMembersEx.startedCount': 'התחילו',
    'adminMembersEx.finishedCount': 'סיימו',
    'adminMembersEx.approvedToast': '✓ {name} אושר',
    'adminMembersEx.approveError': 'שגיאה באישור',
    'adminMembersEx.confirmRemoveAll': 'להסיר את {name} מההימור?\n\nכל ההימורים שלו יימחקו.\nהפעולה לא ניתנת לביטול.',
    'adminMembersEx.removedToast': '{name} הוסר',
    'adminMembersEx.removeError': 'שגיאה בהסרה',
    'adminMembersEx.confirmAction': 'האם אתה בטוח שברצונך {action} את ההימור?',
    'adminMembersEx.actionLock': 'לנעול',
    'adminMembersEx.actionUnlock': 'לפתוח',
    'adminMembersEx.poolLocked': '🔒 ההימור ננעל',
    'adminMembersEx.poolUnlocked': '🔓 ההימור נפתח',
    'adminMembersEx.toggleError': 'שגיאה בעדכון מצב ההימור',
    'adminMembersEx.loadError': 'שגיאה בטעינת חברים',
    'adminMembersEx.memberJoinedMeta': 'הצטרף ב-{date} · {g} בתים · {k} נוקאאוט',
    'adminMembersEx.confirmNewCode': 'האם ליצור קוד שחזור חדש עבור {name}?\n\nהקוד הישן יבוטל מיד. תצטרך לשלוח לו את הקוד החדש בעצמך.',
    'adminMembersEx.newCodeMsg': '✅ קוד שחזור חדש נוצר עבור {name}:\n\n{code}\n\n📋 הקוד יועתק ללוח שלך כשתלחץ "אישור".\nשלח אותו ל-{name} בהודעה פרטית.\n\n⚠️ הקוד הישן בוטל ולא יעבוד יותר.',
    'adminMembersEx.newCodeError': 'שגיאה ביצירת קוד',
    'adminMembersEx.newCodeCopied': '🔑 קוד חדש נוצר והועתק',
    // v2.5.36: admin share new code modal
    'adminShareCode.title': 'קוד שחזור חדש מוכן',
    'adminShareCode.subtitle': 'שלח את הקוד ל-{name} ב-WhatsApp או Telegram, או העתק את הקישור הישיר',
    'adminShareCode.codeLabel': 'הקוד החדש',
    'adminShareCode.message': 'היי {name}! הקוד שלך להימור "{pool}" עודכן. קוד שחזור: {code}\nאו פשוט פתח את הקישור: {link}',
    'adminShareCode.linkCopied': '✓ הקישור הועתק',
    'adminMembersEx.confirmDeleteFull': '⚠️ האם אתה בטוח שברצונך להסיר את {name} מההימור?\n\nפעולה זו תמחק:\n- כל ההימורים שלו ({g} בתים, {k} נוקאאוט)\n- את החשבון שלו לחלוטין\n\nהפעולה לא ניתנת לביטול.',
    'adminMembersEx.finalConfirm': 'אישור אחרון - להסיר את {name}?',
    'adminMembersEx.finalRemovedToast': '✓ {name} הוסר מההימור',
    'adminMembersEx.finalRemoveError': 'שגיאה בהסרת המשתמש',

    // === Admin modal ===
    'adminModal.newCodeTitle': 'צור קוד שחזור חדש',
    'adminModal.newCodeText': 'הקוד הישן יבוטל',
    'adminModal.removeTitle': 'הסר מההימור',
    'adminModal.removeText': 'פעולה זו תמחק את כל ההימורים שלו',

    // === Share modal ===
    'shareModal.title': 'הזמינו חברים',
    'shareModal.subtitle': 'שלח להם את הקישור והם יצטרפו בלחיצה אחת',
    'shareModal.oneClick': 'מצטרפים בקליק אחד — בלי הרשמה ובלי להוריד אפליקציה',
    'shareModal.shareWithFriends': 'שתפו עם החברים',
    'shareModal.copyForDesktop': 'העתק קישור להזמנה',
    'shareModal.orChoose': 'או בחרו אפליקציה',
    'shareModal.email': 'מייל',
    'shareModal.sms': 'SMS',
    'shareModal.igCopied': 'הקישור הועתק — הדביקו אותו בסטורי או בהודעה באינסטגרם',
    'shareModal.emailSubject': 'הזמנה להימור "{poolName}" ב-FriendlyBet',
    'shareModal.copyHint': 'לחץ להעתקה',
    'shareModal.copyLink': 'העתק קישור',
    'shareModal.shareMsg': 'שתף עם הודעה',
    'shareModal.scanCode': 'או סרוק את הקוד למטה:',
    'shareModal.inviteUrl': 'קישור ההזמנה:',
    'shareModal.generatingQR': 'יוצר קוד QR...',
    'shareModal.copyLinkOk': '✓ הקישור הועתק!',
    'shareModal.copyCodeOk': '✓ הקוד הועתק!',
    'shareModal.copyError': 'שגיאה בהעתקה',
    'shareModal.joinTitle': 'הצטרף ל-{name}',

    // === Top scorer locked ===
    'tsLocked.title': 'הפיצ\'ר עדיין נעול',
    'tsLocked.subtitle': 'מחכים לפרסום הסגלים הרשמיים',
    'tsLocked.why': 'למה זה נעול?',
    'tsLocked.whyText': 'פיפ"א טרם פרסמה את הסגלים הרשמיים של כל הקבוצות. כל קבוצה צריכה להגיש 26 שחקנים עד 1 ביוני.',
    'tsLocked.how': 'איך זה ייפתח?',
    'tsLocked.howText': 'המערכת בודקת אוטומטית כל יום. ברגע שהסגלים יתפרסמו - הפיצ\'ר ייפתח לבד עם כל ~736 השחקנים האמיתיים!',
    'tsLocked.what': 'מה אפשר לעשות בינתיים?',
    'tsLocked.whatText': 'תמלא את הימור הבתים והנוקאאוט. הזמן את החברים. כשהפיצ\'ר ייפתח - תקבל התראה.',
    'tsLocked.countdown': '⏱️ עד פתיחת המונדיאל:',
    'tsLocked.openDate': '11 ביוני 2026',
    'tsLocked.lastCheck': 'בדיקה אחרונה: {time}',
    'tsLocked.loadingPlayers': 'שגיאה בטעינת שחקנים',

    // === Top scorer unlocked ===
    'tsUnlocked.heroDesc': 'מי יבקיע הכי הרבה שערים במונדיאל?<br><strong>+{n} נקודות בונוס</strong> אם תנחש נכון!',
    'tsUnlocked.hintTeam': '{code} (קבוצה)',
    'tsUnlocked.searchResults': 'תוצאות חיפוש לפי "{q}"',
    'tsUnlocked.currentLeaders': 'המובילים כרגע',
    'tsUnlocked.forwardsWings': 'החלוצים והכנפיים מהקבוצות החזקות',
    'tsUnlocked.allPlayers': 'כל שחקני המונדיאל',
    'tsUnlocked.showing': 'מציג {n} מתוך {total} תוצאות',
    'tsUnlocked.fallbackPlayer': 'שחקן',
    'tsUnlocked.starBadge': '⭐ כוכב',
    'tsUnlocked.confirmChange': 'להחליף את הבחירה?\n\nמ: {from}\nל: {to}',
    'tsUnlocked.saveError': 'שגיאה בשמירת הבחירה: {msg}',
    'tsUnlocked.fallbackThePlayer': 'השחקן',
    'tsUnlocked.pickedToast': '🥇 בחרת ב-{name}!',
    'tsUnlocked.confirmClear': 'לבטל את הבחירה של מלך השערים?',
    'tsUnlocked.clearError': 'שגיאה בביטול הבחירה',
    'tsUnlocked.clearedToast': 'הבחירה בוטלה',

    // === Members list ===
    'membersList.title': 'משתתפים',
    'membersList.total': 'בסה"כ',
    'membersList.bet': 'הימרו',
    'membersList.notYet': 'עוד לא',
    'membersList.partial': 'הימר על {n} בחירות',
    'membersList.complete': 'השלים את הבתים',
    'membersList.notStarted': 'עדיין לא הימר',
    // v2.5.37: precise status per the new "groups + knockout" check
    'membersList.allDone': '✓ סיים את כל ההימור',
    'membersList.inProgress': 'התחיל לבחור, עוד לא סיים',
    'membersList.needsKnockout': '⚠️ חסר שלב נוקאאוט',
    'membersList.noBets': 'עוד לא הימר',
    'membersList.fallbackUser': 'משתמש',
    'membersList.joinedToday': 'הצטרף היום',
    'membersList.joinedYesterday': 'הצטרף אתמול',
    'membersList.joinedDaysAgo': 'הצטרף לפני {n} ימים',
    'membersList.joinedOn': 'הצטרף ב-{date}',
    'membersList.loadError': 'שגיאה בטעינת המשתתפים',

    // === Recovery display ===
    'recoveryDisplay.title': 'קוד השחזור שלך',
    'recoveryDisplay.heroSubtitle': 'הקוד הזה הוצג רק פעם אחת כשהצטרפת. מסיבות אבטחה לא ניתן להציג אותו שוב.',
    'recoveryDisplay.didntSave': 'לא שמרת את הקוד?',
    'recoveryDisplay.didntSaveText': 'פנה למארגן ההימור ובקש לייצר עבורך קוד חדש. הקוד הקיים יישאר תקף - יש לך 2 קודים בו זמנית.',
    'recoveryDisplay.whyTitle': 'למה אני צריך קוד שחזור?',
    'recoveryDisplay.whyText': 'קוד השחזור הוא הדרך היחידה להתחבר אם החלפת מכשיר, ניקית את הדפדפן, או רוצה להיכנס ממכשיר אחר. שמור אותו במקום בטוח!',
    'recoveryDisplay.backBtn': 'הבנתי, חזור לדשבורד',
    'recoveryDisplay.copiedToast': '✓ קוד השחזור הועתק',
    'recoveryDisplay.notFound': 'לא נמצא קוד שחזור',

    // === Help ===
    'helpEx.section1Title': '📋 איך מהמרים?',
    'helpEx.q1': '1. הצטרפות להימור',
    'helpEx.a1': 'לחץ "הצטרף להימור" בדף הבית, הזן קוד 5 תווים שקיבלת מהמארגן, בחר כינוי ושמור את קוד השחזור.',
    'helpEx.q2': '2. הימור על שלב הבתים',
    'helpEx.a2': 'בכל בית (12 בתים) בחר 2 או 3 קבוצות שיעלו לשלב הבא. סך הכל צריך לבחור בדיוק 32 קבוצות.',
    'helpEx.q3': '3. ניקוד',
    'helpEx.a3': 'תקבל נקודה (או יותר עם מכפילים) על כל קבוצה שניחשת נכון שתעלה לשלב הבא.',
    'helpEx.section2Title': '🎲 מכפילי סיכון',
    'helpEx.q4': '⭐ פייבוריטית - ×1',
    // v2.5.40: tier names alone (no ×N suffix) - JS appends the live value
    'helpEx.tierFav': 'פייבוריטית',
    'helpEx.tierCont': 'מתמודדת',
    'helpEx.tierUnd': 'אנדרדוג',
    'helpEx.a4': 'קבוצות חזקות. ניחוש "בטוח" אבל נקודה אחת בלבד.',
    'helpEx.q5': '⚔️ מתמודדת - ×1.5',
    'helpEx.a5': 'קבוצות באמצע הדירוג. סיכון בינוני, פרס בינוני.',
    'helpEx.q6': '🐶 אנדרדוג - ×2',
    'helpEx.a6': 'קבוצות חלשות. סיכון גבוה אבל נקודה כפולה אם צדקת!',
    'helpEx.section3Title': '🔐 אבטחה ופרטיות',
    'helpEx.q7': 'איבדתי את קוד השחזור',
    'helpEx.a7': 'פנה למארגן ההימור - רק הוא יכול לייצר עבורך קוד חדש. אנחנו לא שומרים את הקוד שלך בשרת מסיבות אבטחה.',
    'helpEx.q8': 'אילו פרטים אישיים נשמרים?',
    'helpEx.a8': 'רק הכינוי שבחרת וההימורים שלך. אין דרישה לאימייל, טלפון או פרטים אישיים אחרים.',
    'helpEx.q9': 'מה קורה אחרי הטורניר?',
    'helpEx.a9': '30 ימים אחרי סיום המונדיאל, כל הנתונים נמחקים אוטומטית מהמערכת.',
    'helpEx.section4Title': '💰 כסף ותשלומים',
    'helpEx.q10': 'איך עובדים התשלומים?',
    'helpEx.a10': 'FriendlyBet לא מטפלת בכסף בכלל! כל המעורבות הכספית מתבצעת מחוץ לאפליקציה - בקבוצות וואטסאפ או טלגרם של ההימור.',
    'helpEx.footer': 'יש לך שאלה נוספת? פנה למארגן ההימור שלך.',

    // === Status modal ===
    'statusModal.almostTitle': 'כמעט סיימת!',
    'statusModal.missingPicks': 'חסר{plural} עוד {n} עול{pluralN}',
    'statusModal.doneTitle': 'מצוין! 🎉',
    'statusModal.doneSubtitle': 'בחרת את כל ה-32 העולות',
    'statusModal.picked': 'בחרת',
    'statusModal.of': 'מתוך',
    'statusModal.missing': 'חסר',
    'statusModal.canAddTitle': 'בתים שאפשר להוסיף בהם עולה שלישית:',
    'statusModal.noGroupsToAdd': 'לא נמצאו בתים עם 2 עולות.<br/>תוכל להוסיף בכל בית.',
    'statusModal.expandable': '{n} בתים עם 2 עולות - לחץ כדי להוסיף שלישית:',
    'statusModal.closeBtn': 'סגור והמשך בעצמי',

    // === Generic / app.js toasts ===
    'errors.loadError': 'שגיאה בטעינה',
    'errors.unexpected': 'שגיאה לא צפויה',
    'errors.unexpectedMsg': 'שגיאה לא צפויה: {msg}',
    'errors.missingData': 'שגיאה - חסרים נתונים',
    'errors.reconnect': 'שגיאה - אנא התחבר מחדש',
    'errors.tryAgain': 'שגיאה - אנא נסה שוב',
    'errors.serverConnecting': 'מתחבר לשרת... נסה שוב בעוד רגע',
    'errors.serverConnectingShort': 'מתחבר לשרת...',
    'errors.serverConnectingRetry': 'מתחבר לשרת... נסה שוב',
    'errors.searchingPool': 'מחפש את ההימור...',
    'errors.poolSearchError': 'שגיאה בחיפוש ההימור. נסה שוב.',
    'errors.poolNotFoundCode': 'לא נמצא הימור עם הקוד {code}',
    'errors.poolLockedNoJoin': '🔒 ההימור הזה נעול ולא מקבל חברים חדשים',
    'errors.poolClosedKickoff': '🔒 ההרשמה לפול הזה נסגרה עם פתיחת המונדיאל. אפשר ליצור פול חדש עד {time}.',
    'errors.poolClosedLate': '🔒 ההרשמה וההימורים נסגרו כשהקבוצה הראשונה התחילה את המשחק השני שלה ({time}).',
    'errors.lateEntryClosed': '🔒 אי אפשר ליצור הימורים חדשים אחרי תחילת המשחק השני של קבוצה כלשהי ({time}).',
    'errors.joinCodeRequired': 'נא להזין קוד הימור',
    'errors.joinCodeLen': 'קוד הימור הוא 5 תווים',
    'errors.creatingUser': 'יוצר משתמש...',
    'errors.creatingUserFail': 'שגיאה ביצירת המשתמש: {msg}',
    'errors.creatingPool': 'יוצר את ההימור...',
    'errors.uniqueCodeFail': 'שגיאה ביצירת קוד ייחודי',
    'errors.creatingPoolFail': 'שגיאה ביצירת ההימור: {msg}',
    'errors.creatingAdminFail': 'שגיאה ביצירת מנהל ההימור: {msg}',
    'errors.poolCreated': 'ההימור נוצר בהצלחה! 🎉',
    'errors.alreadyMember': 'אתה כבר חבר בהימור.\n\nכדי להצטרף להימור חדש, תצטרך לצאת מהקיים.\n\nלצאת ולהצטרף להימור החדש?',

    // === v2.0.0 - Wizard ===
    'wizard.title': 'הגדרת ההימור',
    'wizard.stepLabel': 'שלב {n} מתוך {total}',
    'wizard.continueToSetup': 'המשך להגדרת ההימור',
    'wizard.next': 'הבא',
    'wizard.back': 'חזור',
    'wizard.createPool': 'צור הימור',
    'wizard.recommended': 'מומלץ ⭐',
    'wizard.advanced': 'מתקדם',
    'wizard.step1.title': 'בחר את שיטת ההימור',
    'wizard.step1.subtitle': 'איך השחקנים שלך יהמרו?',
    'wizard.step1.singlePhase.title': 'הימור חד-פעמי',
    'wizard.step1.singlePhase.description': 'השחקנים מהמרים פעם אחת לפני תחילת המונדיאל. הם מנחשים הכל: מיקום בבתים, שלב הנוקאאוט המלא, מנצחת הטורניר, ומלך השערים.',
    'wizard.step1.twoPhase.title': 'הימור דו-שלבי',
    'wizard.step1.twoPhase.description': 'השחקנים מהמרים פעמיים: פעם לפני הבתים (רק על הקבוצות שיעלו מהבית), ופעם נוספת אחרי הבתים על שלב הנוקאאוט ומלך השערים. יותר ריאלי, אבל דורש כניסה להימור בשני זמנים שונים.',
    'wizard.step2.title': 'חוקי הניקוד',
    'wizard.step2.subtitle': 'איך מחושבות נקודות?',
    'wizard.step2.useDefaults': 'שימוש בחוקים המומלצים',
    'wizard.step2.useDefaults.desc': 'הגדרות מאוזנות שמתאימות לרוב הקבוצות.',
    'wizard.step2.customize': 'התאמה אישית של החוקים',
    'wizard.step2.customize.desc': 'קבע בעצמך את הניקוד לכל שלב.',
    'wizard.step3.title': 'סיכום ויצירה',
    'wizard.step3.subtitle': 'בדוק את ההגדרות לפני יצירת ההימור',
    'wizard.summary.poolName': 'שם ההימור',
    'wizard.summary.admin': 'המארגן',
    'wizard.summary.mode': 'שיטת הימור',
    'wizard.summary.totalPoints': 'סך נקודות מקסימלי',
    'wizard.summary.rules': 'חוקי הניקוד',
    'wizard.rule.group_first': 'מקום ראשון בבית',
    'wizard.rule.group_second': 'מקום שני בבית',
    'wizard.rule.group_third': 'מקום שלישי בבית',
    'wizard.rule.group_fourth': 'מקום רביעי בבית',
    'wizard.rule.third_place_advance': 'שלישית שעולה לשלב הבא',
    'wizard.rule.round_of_32': 'סבב 32',
    'wizard.rule.round_of_16': 'שמינית גמר',
    'wizard.rule.quarter_final': 'רבע גמר',
    'wizard.rule.semi_final': 'חצי גמר',
    'wizard.rule.final': 'גמר',
    'wizard.rule.tournament_winner': 'מנצחת הטורניר',
    'wizard.rule.top_scorer': 'מלך השערים',
    // v2.5.7: scoring rule group titles
    'wizard.ruleGroup.group': 'שלב הבתים',
    'wizard.ruleGroup.knockout': 'נוקאאוט',
    'wizard.ruleGroup.bonus': 'בונוסים',
    'wizard.ruleGroup.winner': 'מנצחת הטורניר',
    // v2.5.27: two-phase combined "advancing team" label + multipliers explanation
    'wizard.rule.advancing_team': 'כל קבוצה שעולה מהבית',
    'wizard.multipliers.explainTitle': 'איך זה עובד',
    'wizard.multipliers.explain': 'כל קבוצה מסווגת לאחד משלושה דירוגים לפי דירוג FIFA. הימור על קבוצה חלשה יותר שמתממש מזכה אותך ביותר נקודות: פייבוריטית ×1, מתמודדת ×1.5, אנדרדוג ×2. המכפיל מוחל על הנקודות שמרוויחים על הקבוצה הזו בלבד.',
    // v2.5.47: single_phase-only note + power-toggle label
    'wizard.multipliers.singlePhaseNote': 'בהימור חד-שלבי המכפילים משפיעים רק משלב הנוקאאוט. ניחושי מיקומי הבתים מנוקדים לפי המיקום שניחשת (4/3/2/1 כברירת מחדל) וללא מכפיל.',
    'wizard.multipliers.powerOn': 'מכפילים מופעלים',
    'wizard.multipliers.powerOff': 'מכפילים כבויים',
    // v2.5.56: "Optional" tag next to the multipliers title in the wizard
    'wizard.multipliers.optional': 'אופציונלי',
    'wizard.multipliers.perTeamTitle': 'מכפיל סיכון פר-קבוצה (אופציונלי)',
    'wizard.multipliers.perTeamHelp': 'אפשר להגדיר ידנית מכפיל לקבוצה מסוימת. ערכים שלא נגעת בהם נשארים על מכפיל הקטגוריה.',
    'wizard.multipliers.perTeamReset': 'איפוס לכל הקבוצות',

    // === v2.0.0 - Single-phase betting ===
    'betting.singlePhase.title': 'הימור חד-פעמי',
    'betting.groupPositions.title': 'מיקום בבתים',
    'betting.groupPositions.instructions': 'הקבוצות מסודרות לפי דירוג FIFA. גרור כדי לשנות את הסדר.',
    // v2.5.63: explains that the points are awarded for correctly
    // predicting each POSITION at the end of the group stage, not just
    // for picking advancing teams.
    'betting.groupStep': 'בית {n} מתוך {total}',
    'betting.position.1': 'מקום ראשון',
    'betting.position.2': 'מקום שני',
    'betting.position.3': 'מקום שלישי',
    'betting.position.4': 'מקום רביעי',
    'betting.groupFull': 'הבית מלא. הסר קבוצה כדי להחליף.',
    'betting.groupsIncomplete': 'חסרות תוצאות בבתים: {letters}',
    // v2.5.62: softer "info" variant - the flow no longer blocks here
    'betting.groupsIncompleteHint': 'התקדמת עם בתים חסרים: {letters}. תמיד אפשר לחזור ולהשלים.',
    'betting.finalMissingHint': 'התקדמת בלי לבחור את מנצחת הגמר. תמיד אפשר לחזור.',
    // v2.5.64: partial-save toast from the summary screen
    'betting.partialSaveHint': '✓ ההימור נשמר. עוד נשאר: {details}',
    'betting.continueToBracket': 'המשך לברקאט',
    // v2.5.66: tertiary "skip" option on the sp-groups-screen
    'betting.skipForNow': 'דלג בינתיים — נחזור לזה אחר כך',
    'betting.bracket.title': 'שלב הנוקאאוט שלך',
    'betting.bracket.instructions': 'שלב הנוקאאוט נוצר מתוצאות הבתים שלך. בכל משחק - בחר את המנצח.',
    // v2.5.72: shown on the FINAL match - the winner is the champion, worth
    // the final points (no separate bonus). Read live from scoring_rules.
    'betting.bracket.finalPoints': '🏆 המנצחת בגמר היא אלופת הטורניר — ניחוש מדויק = {n} נק\'',
    'betting.tournamentWinner.title': 'מנצחת הטורניר',
    'betting.tournamentWinner.question': 'מי תזכה במונדיאל?',
    'betting.tournamentWinner.subtitle': 'בחר את הקבוצה שלדעתך תרים את הגביע',
    'betting.winnerRequired': 'בחר את מנצחת הטורניר',
    'betting.cascadeWarn': 'שינוי הבחירה הזו ימחק {n} בחירות בשלבים הבאים שתלויות בה (כי הקבוצה שבחרת קודם כבר לא תתקדם). להמשיך?',
    'betting.finalRequired': 'בחר את המנצחת של משחק הגמר לפני שתמשיך',
    'betting.summary.title': 'סיכום הניחושים',
    'betting.summary.warning': 'תוכל לערוך את הניחושים כל עוד המונדיאל לא התחיל. ברגע שמשחק ראשון מתחיל - הניחושים יינעלו.',
    'betting.summary.groups': 'תוצאות הבתים',
    'betting.summary.bracket': 'ברקאט',
    'betting.summary.winner': 'מנצחת הטורניר',
    'betting.summary.topScorer': 'מלך השערים',
    'betting.summary.submit': 'שמור את הניחושים שלי',
    'betting.summary.saveChanges': 'שמירת שינויים',
    'betting.saved': 'הניחושים נשמרו! 🎯',
    'betting.continueToSummary': 'המשך לסיכום',
    'betting.summary.editTopScorer': 'ערוך מלך שערים',
    'betting.summary.editPicks': 'ערוך קבוצות וברקאט',
    'betting.notPicked': 'לא נבחר',
    'betting.confirmSubmit': '⚠️ לשלוח את הניחושים הסופיים?\n\nאחרי שליחה ותחילת הטורניר - לא ניתן יהיה לשנות!',
    'betting.submitted': 'הניחושים נשלחו בהצלחה! 🎉',
    'betting.locked.title': 'הניחושים שלך',
    'betting.locked.heading': 'הניחושים נשלחו ונעולים',
    'betting.locked.message': 'לא ניתן לשנות יותר. צפה בניחושים שלך למטה.',

    // === v2.0.0 - Leaderboard breakdown ===
    'leaderboard.viewBracket': 'צפה בניחושי הנוקאאוט',
    'leaderboard.bracketOfTitle': 'ניחושי הנוקאאוט של {name}',
    'leaderboard.breakdown.group': 'בתים',
    'leaderboard.breakdown.knockout': 'נוקאאוט',
    'leaderboard.breakdown.bonus': 'בונוס',
    'leaderboard.noPicks': 'אין ניחושים להצגה',

    // === v2.1.4 - Dashboard reflow ===
    'dashboard.preTournament.title': 'המונדיאל עוד לא התחיל',
    'dashboard.preTournament.subtitle': 'הדירוג יופיע כאן כשהמשחקים יתחילו',
    // v2.5.36: state-aware progress card text
    'dashboard.progress.notStarted.title': 'מוכן להמר? 🎯',
    'dashboard.progress.notStarted.subtitle': 'בחר את הקבוצות שלך וצא לדרך — לוקח רק כמה דקות',
    // v2.5.38: admin-specific first-time CTA. Admins should invite friends
    // first so there\'s a pool to bet against, then make their own picks.
    'dashboard.progress.adminInviteFirst.title': 'מוכן להמר? 🎯',
    'dashboard.progress.adminInviteFirst.subtitle': 'קודם כל הזמן חברים, ואחר כך תתחיל להמר בעצמך — לוקח רק כמה דקות',
    'dashboard.progress.partial.title': 'אתה בעיצומו של ההימור💪',
    'dashboard.progress.partial.subtitle': 'עוד כמה בחירות וסיימת',
    // v2.5.38: predictions aren\'t actually locked at submit time - they\'re
    // editable until the tournament kicks off. Text reflects that.
    'dashboard.progress.allSet.title': 'סגרת הכל! 🎉',
    'dashboard.progress.allSet.subtitle': 'ההימור שלך בפנים. עוד אפשר לערוך עד שריקת הפתיחה של המונדיאל',
    'dashboard.startCta.title': 'התחל להמר על המונדיאל',
    'dashboard.startCta.subtitle': 'בחר את הקבוצות שלך לכל בית',
    'dashboard.continueCta.title': 'המשך את ההימור',
    'dashboard.continueCta.partialGroups': 'השלמת {n} מתוך {total} בתים',
    'dashboard.continueCta.bracket': 'נשאר להשלים את עץ הנוקאאוט עד האלופה',
    'dashboard.continueCta.topScorer': 'נשאר לבחור את מלך השערים',
    'dashboard.continueCta.almostDone': 'עוד צעד אחד - ברקאט ומלך השערים',
    'dashboard.editCta.title': 'ערוך את ההימור שלך',
    'dashboard.viewCta.title': 'צפה בניחושים שלך',
    'dashboard.viewCta.subtitle': 'עדכן או ערוך עד שהמונדיאל מתחיל',

    // === v2.1.0 - Recovery code screen ===
    'recovery.poolCreated.title': 'ההימור נוצר!',
    'recovery.poolCreated.subtitle': 'ברוך הבא להימור שלך!',
    'recovery.joined.title': 'הצטרפת!',
    'recovery.joined.subtitle': 'בוא נתחיל לנחש!',
    'recovery.codeLabel': 'קוד השחזור האישי שלך',
    'recovery.warning.title': 'הכי חשוב: שמרו כתמונה',
    'recovery.warning.text': 'זו הדרך היחידה לחזור לחשבון אם תתנתקו. שמרו בפרטיות, אל תשתפו.',
    'recovery.privacy': 'זה כמו סיסמה. שמור על פרטיות, אל תשתף.',
    'recovery.qr.scanHint': 'אם תתנתקו בעתיד — תוכלו לסרוק את ה-QR או להקליד את הקוד כדי לחזור להימור.',
    'recovery.qr.scanToLogin': 'סרוק כדי להתחבר',
    // v2.5.37: shown only to members (not admin) on the recovery code screen
    'recovery.adminHelp.title': 'איבדת את הקוד? אין בעיה.',
    'recovery.adminHelp.text': 'תמיד אפשר לבקש מהאדמין של ההימור שישלח לך קוד שחזור חדש בוואטסאפ או בטלגרם.',
    'recovery.button.copy': 'העתק',
    'recovery.button.email': 'שלח לעצמי באימייל',
    'recovery.button.download': 'הורד קובץ טקסט',
    'recovery.button.copied': '✓ הועתק!',
    'recovery.toast.copied': '✓ הועתק ללוח!',
    'recovery.toast.downloaded': '✓ הקובץ הורד!',
    'recovery.button.continue': 'המשך להימור',
    'recovery.button.close': 'סגור',
    'recovery.warningModal.title': 'שמרת את הקוד?',
    'recovery.warningModal.text': 'תצטרך את הקוד כדי להתחבר ממכשיר אחר, או מהמכשיר הזה אם תתנתק. בלי הקוד — אין דרך לחזור לחשבון.',
    'recovery.warningModal.saveCode': 'שמור את הקוד',
    'recovery.warningModal.continueAnyway': 'המשך בכל מקרה',
    'recovery.warningModal.notYet': 'עדיין לא, חזור לשמור',
    'recovery.warningModal.yesSaved': 'כן, המשך להימור',
    'recovery.menu.viewCode': 'קוד השחזור שלי',
    'recovery.viewMode.title': 'קוד השחזור שלך',
    'recovery.email.subject': 'קוד שחזור FriendlyBet',
    'recovery.email.body': 'שלום! 👋\n\nזה קוד השחזור האישי שלך ל-FriendlyBet.\nשמור אותו במקום בטוח - תצטרך אותו כדי להתחבר.\n\nקוד שחזור: {code}\n\nהימור: {poolName}\nהיכנס דרך: https://friendlybet.live\n\n⚠️ שמור על פרטיות! אל תשתף עם אחרים.',
    'recovery.txt.header': 'קוד שחזור FriendlyBet',
    'recovery.txt.codeLabel': 'קוד השחזור האישי שלך:',
    'recovery.txt.poolLabel': 'הימור:',
    'recovery.txt.createdLabel': 'נוצר:',
    'recovery.txt.important': 'חשוב:',
    'recovery.txt.warning1': 'שמור על קוד זה בפרטיות',
    'recovery.txt.warning2': 'אל תשתף עם אף אחד',
    'recovery.txt.warning3': 'תצטרך אותו כדי להתחבר לחשבון שלך',
    'recovery.txt.loginAt': 'היכנס דרך:',

    // === v2.4 additions (Hebrew) ===
    'recovery.button.screenshot': 'שמור כתמונה',
    'recovery.button.email': 'שלח לעצמי באימייל',
    'recovery.button.download': 'הורד קובץ טקסט',
    'recovery.button.emailMe': 'שלח את הקוד לאימייל שלי',
    'recovery.toast.screenshotDone': '✓ סומן כצולם',
    'recovery.toast.emailCopied': '✓ תוכן המייל הועתק ללוח - הדבק במייל שלך',
    'recovery.toast.emailOpened': '✓ נפתח חלון מייל',
    'shareModal.copy': 'העתק',
    'recovery.toast.emailOpenedWithBackup': '✓ נפתח חלון מייל - ונשמר גיבוי בלוח',
    'recovery.toast.popupBlocked': 'הדפדפן חסם את הפתיחה. אנא אפשר חלונות קופצים ונסה שוב.',

    'recovery.screenshot.title': 'שמור את הקוד כתמונה',
    'recovery.screenshot.intro': 'יצרנו עבורך תמונה עם קוד השחזור. שמור אותה בגלריה או שתף לעצמך.',
    'recovery.screenshot.codeLabel': 'קוד השחזור שלך',
    'recovery.screenshot.tip': 'אחרי הצילום, בדוק בגלריה שהקוד יצא ברור וקריא.',
    'recovery.screenshot.done': 'צילמתי, המשך',
    // v2.5.6: auto-screenshot strings
    'recovery.screenshot.generating': 'מכין תמונה...',
    'recovery.screenshot.save': 'שמור תמונה למכשיר',
    'recovery.screenshot.ios1': 'לחץ בו-זמנית על {k1} + {k2}',
    'recovery.screenshot.ios2': 'התמונה תיווצר ותופיע לזמן קצר בתחתית המסך',
    'recovery.screenshot.ios3': 'הצילום יישמר אוטומטית באפליקציית התמונות',
    'recovery.screenshot.android1': 'לחץ בו-זמנית על {k1} + {k2} למשך ~1 שנייה',
    'recovery.screenshot.samsung1': 'לחץ בו-זמנית על {k1} + {k2} (או החלק עם כף היד על המסך)',
    'recovery.screenshot.android2': 'תוצג תצוגה מקדימה של הצילום',
    'recovery.screenshot.android3': 'הצילום יישמר אוטומטית בגלריה',
    'recovery.screenshot.mac1': 'לחץ {k1} + {k2} + {k3} ובחר את אזור הקוד',
    'recovery.screenshot.mac2': 'הצילום יישמר בשולחן העבודה',
    'recovery.screenshot.win1': 'לחץ {k1} + {k2} + {k3} ובחר את אזור הקוד',
    'recovery.screenshot.win2': 'הצילום יועתק ללוח / יישמר בתיקיית "צילומי מסך"',
    'recovery.screenshot.generic1': 'השתמש בפונקציית צילום המסך של המכשיר שלך',
    'recovery.screenshot.generic2': 'התמונה תישמר אוטומטית בגלריה / שולחן העבודה',

    'exitApp.title': 'לצאת מהאפליקציה?',
    'exitApp.text': 'תוכל לחזור בכל זמן וההימור שלך נשמר אוטומטית.',
    'exitApp.stay': 'הישאר באפליקציה',
    'exitApp.confirm': 'צא',

    'knockoutFirst.instructions': 'בחר את הקבוצה שלדעתך תעלה לסבב הבא',
    'knockoutFirst.pointsLabel': '{n} נקודות עבור הימור מדוייק',
    // v2.5.60: shown when the two teams have different risk multipliers,
    // so a correct pick earns different totals depending on the team.
    'knockoutFirst.pointsLabelRange': '{min} או {max} נקודות עבור הימור מדוייק (לפי מכפיל הסיכון של הקבוצה)',
    // v2.5.65: extra line on the FINAL match - tournament winner bonus
    'knockoutFirst.finalIsChampion': '🏆 המנצחת בגמר היא אלופת הטורניר',
    'knockoutFirst.skip': 'דלג בינתיים',
    'knockoutFirst.completedToast': 'מעולה! עכשיו תוכל לערוך כל בחירה',

    'groups.lockedTournamentStarted': 'הטורניר התחיל - לא ניתן יותר לשנות את ההימור',
  },

  en: {
    // === General / Common ===
    'app.name': 'FriendlyBet',
    'openInBrowser.android': 'Open in Chrome to stay signed in after you close WhatsApp.',
    'openInBrowser.ios': 'For the best experience, open in Safari (the arrow icon up top) so you stay signed in.',
    'openInBrowser.button': 'Open in Chrome',
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.back': 'Back',
    'nav.dashboard': 'Back to dashboard',
    'nav.myPicks': 'My picks',
    'common.next': 'Next',
    'common.confirm': 'Confirm',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.copy': 'Copy',
    'common.share': 'Share',
    'common.copied': 'Copied!',
    'common.continue': 'Continue',
    'common.skip': 'Skip',
    'common.create': 'Create',
    'common.add': 'Add',
    'common.remove': 'Remove',
    'common.edit': 'Edit',
    'common.update': 'Update',
    'common.send': 'Send',
    'common.points': 'pts',
    'common.bonusPoints': 'bonus pts',
    'common.you': 'You',
    'common.admin': 'Admin',
    'common.adminBadge': 'Admin ✓',
    'common.day': 'day',
    'common.days': 'days',
    'common.daysUntil': 'days until',
    'common.lastUpdated': 'Updated',
    'common.allRights': 'All rights reserved',
    'common.menu': 'Menu',

    // === Onboarding ===
    'welcome.title': 'FriendlyBet',
    'welcome.subtitle': 'World Cup Predictions with Your Friends',
    'welcome.tagline': '100% FREE · NO ADS · NO LIMITS · NO PAYWALLS',
    'welcome.create': 'Create New Pool',
    'welcome.join': 'Join Pool',
    'welcome.recoveryLogin': 'Log in with QR or recovery code',
    // v2.5.16: recovery login flow
    'recoveryLogin.title': 'Log back in',
    'recoveryLogin.heading': 'Scan your QR or enter your code',
    'recoveryLogin.subtitle': 'Pick the QR image you saved — or type your 16-character recovery code.',
    'recoveryLogin.codeLabel': 'Recovery code',
    'recoveryLogin.submit': 'Log in',
    'recoveryLogin.qrButton': 'Log in with my QR',
    'recoveryLogin.processing': 'Reading QR...',
    'recoveryLogin.or': 'or enter your code manually',
    'recoveryLogin.qrNotFound': 'No QR found in that image. Try another image, or enter your code manually.',
    'recoveryLogin.linkInvalid': 'That link is expired or invalid. Enter your code manually.',
    'recoveryLogin.errorShort': 'Code is too short — make sure you entered it fully',
    'recoveryLogin.errorNotFound': 'Code not found. Make sure it matches exactly what you received.',
    'recoveryLogin.errorNoPool': 'The pool linked to this code could not be found',
    'recoveryLogin.success': 'Welcome back, {nickname}!',
    'welcome.noSignup': 'Open source · No personal data collected · <a href="https://github.com/Aviatorpo/friendlybet" target="_blank" rel="noopener">GitHub</a>',
    
    'create.title': 'Create New Pool',
    'create.poolName': 'Pool Name',
    'create.poolNamePlaceholder': 'e.g. The Boys Pool',
    'create.nickname': 'Your Nickname',
    'create.nicknamePlaceholder': 'How you appear on the leaderboard',
    'create.button': 'Create Pool',
    
    'join.title': 'Join Pool',
    'join.whichPool': 'Which Pool?',
    'join.enterCode': 'Enter the pool code you received',
    'join.alreadyMemberQ': 'Already joined before and have an account?',
    'join.code': 'Pool Code',
    'join.codePlaceholder': '5 letters, e.g. ABCDE',
    'join.nickname': 'Your Nickname',
    'join.nicknamePlaceholder': 'How you appear on the leaderboard',
    'join.button': 'Join',
    'join.invitedTo': 'You\'re invited to',
    'join.poolCode': 'Code',
    'join.findError': 'Code not found. Try again.',
    'join.poolLocked': 'Pool Locked',
    'join.poolLockedDesc': 'The admin has locked this pool. Cannot join.',
    
    'recovery.title': 'Login with Recovery Code',
    'recovery.code': 'Your Code',
    'recovery.codePlaceholder': '16 characters',
    'recovery.button': 'Log In',
    
    'recoveryCode.title': 'Save your recovery code!',
    'recoveryCode.subtitle': 'You\'ll need it to log in from another device',
    'recoveryCode.warning': 'This code won\'t be shown again. Save it somewhere safe.',
    'recoveryCode.continue': 'Got it, continue',
    'recoveryCode.copyButton': 'Copy code',
    
    // === Dashboard ===
    'dashboard.greeting': 'Hi',
    'recoverBracket.title': 'Your knockout bracket wasn’t saved',
    'recoverBracket.sub': 'Your group-stage picks were saved successfully ✓ but due to a technical glitch your knockout (bracket) picks weren’t saved. Please re-enter them before the World Cup starts — sorry for the inconvenience!',
    'recoverBracket.cta': 'Fill the knockout',
    'recoverBracket.recovered': 'Your picks were recovered! ✓ Review them to make sure everything looks right',
    'dashboard.adminNudge.title': '{n} member(s) still need to verify their knockout',
    'dashboard.adminNudge.sub': 'We found a silent save issue affecting some knockout brackets — and some members may simply be unfinished. Ask everyone listed to reopen FriendlyBet, verify their bracket is saved, and complete it if anything’s missing before kickoff. The ready-made message is worded to fit both.',
    'dashboard.adminNudge.view': 'Who?',
    'dashboard.tpIncident.title': 'Some of your picks weren’t saved due to a bug — we’re sorry',
    'dashboard.tpIncident.sub': 'A glitch on our side meant the group and bracket picks in this pool didn’t save properly. We’ve fixed it, and from now on every pick is saved and backed up automatically. Please re-enter your predictions — it only takes a minute.',
    'dashboard.tpIncident.deadline': 'We’ve given your pool extra time: you can re-enter until {date}.',
    'dashboard.tpIncident.cta': 'Re-enter my picks',
    'dashboard.tpIncident.copy': 'Copy apology message for the group',
    'dashboard.tpIncident.copyMessage': 'Hi 👋 There was a bug in FriendlyBet that stopped some picks (groups and bracket) from saving. It’s now fixed — and everything is saved and backed up from here on. Because of it we got extra time: you can re-enter until {date}. Please reopen the app and fill in your predictions: {link} 🙏⚽',
    'dashboard.tpIncident.copied': 'Apology message copied — paste it into your group',
    'reopen.notAvailable': 'Re-entry isn’t available right now. Contact your pool admin.',
    'reopen.done': 'Your knockout bracket was saved! ✓',
    'reopen.walkthroughNote': 'Sorry — we corrected FIFA’s official third-place knockout pairing table. Your group picks, third-place teams, and top scorer are locked; only the knockout bracket can be updated.',
    'reopen.user.preKickoffTitle': 'Important: your knockout bracket needs fixing',
    'reopen.user.preKickoffTitlePool': 'Knockout review window opened for your pool',
    'reopen.user.preKickoffSub': 'We’re genuinely sorry. Because of a FriendlyBet mistake, some third-place teams were shown in the wrong knockout matches. Please review and fix your knockout picks now. Picks that don’t match the corrected bracket may score 0 points.',
    'reopen.user.preKickoffSubHard': 'We’re genuinely sorry. Because of a FriendlyBet mistake, some third-place teams were shown in the wrong knockout matches. Your bracket includes at least one pick for a matchup that no longer exists in the corrected official bracket. Please review and fix your knockout picks now. Picks that don’t match the corrected bracket may score 0 points.',
    'reopen.user.preKickoffSubPool': 'We’re genuinely sorry. We corrected a FriendlyBet mistake where some third-place teams were shown in the wrong knockout matches. Your own bracket is not flagged as broken, but because other members in your pool were affected, everyone gets the same review window for fairness. You can review your knockout bracket against the corrected official version.',
    'reopen.user.preKickoffCta': 'Review knockout now →',
    'reopen.user.preKickoffPendingTitle': 'Important: your knockout may need review',
    'reopen.user.preKickoffPendingSub': 'We’re genuinely sorry — we corrected an error in the third-place pairings. Picks that do not match the corrected official bracket may score 0 points.',
    'reopen.user.approvedTitle': 'Important: your knockout bracket needs fixing',
    'reopen.user.approvedTitlePool': 'Knockout review window opened for your pool',
    'reopen.user.approvedSub': 'We’re genuinely sorry. Because of a FriendlyBet mistake, some third-place teams were shown in the wrong knockout matches. Please review and fix your knockout picks now. Picks that don’t match the corrected bracket may score 0 points. Your group picks, third-place teams, and top scorer stay locked.',
    'reopen.user.approvedSubHard': 'We’re genuinely sorry. Because of a FriendlyBet mistake, some third-place teams were shown in the wrong knockout matches. Your bracket includes at least one pick for a matchup that no longer exists in the corrected official bracket. Please review and fix your knockout picks now. Picks that don’t match the corrected bracket may score 0 points. Your group picks, third-place teams, and top scorer stay locked.',
    'reopen.user.approvedSubPool': 'We’re genuinely sorry. We corrected a FriendlyBet mistake where some third-place teams were shown in the wrong knockout matches. Your own bracket is not flagged as broken, but because other members in your pool were affected, everyone gets the same review window for fairness. You can review your knockout bracket against the corrected official version. Your group picks, third-place teams, and top scorer stay locked.',
    'reopen.user.cta': 'Fix my knockout bracket →',
    'reopen.user.ctaPool': 'Review my knockout bracket →',
    'reopen.user.expires': 'Open until {time}',
    'reopen.user.pendingTitle': 'Important: your knockout may need review',
    'reopen.user.pendingSub': 'We’re genuinely sorry — we corrected an error in the third-place pairings. Picks that do not match the corrected official bracket may score 0 points. Ask your pool admin to open knockout review for you.',
    'reopen.admin.allowBtn': 'Open knockout for 7 days',
    'reopen.admin.extendBtn': 'Add 7 days',
    'reopen.admin.granted': '✓ Re-entry enabled',
    'reopen.admin.grantedUntil': '✓ Open until {time}',
    'reopen.admin.copyBtn': 'Copy reminder for member',
    'reopen.admin.notEligible': 'This member can’t be auto-recovered (missing data). Contact support.',
    'reopen.admin.noCode': 'No recovery code in this session.',
    'reopen.admin.copied': 'Message copied! Paste it to your member 📋',
    'reopen.admin.personalMsg': 'Hi {name}! Sorry, FriendlyBet corrected a mistake where some third-place teams were shown in the wrong knockout matches. I opened 7 days for you to review/edit only the knockout bracket — your group picks and top scorer stay as they were. Please open friendlybet.live and check your bracket. Thanks.',
    'dashboard.countdown.title': 'First match kicks off in',
    'dashboard.countdown.live': '🔴 The tournament has started!',
    'dashboard.countdown.days': 'days',
    'dashboard.countdown.hours': 'hrs',
    'dashboard.countdown.minutes': 'min',
    'dashboard.countdown.seconds': 'sec',
    'dashboard.liveStatus.kicker': 'LIVE',
    'dashboard.liveStatus.zeroPoints': '0 pts so far',
    'dashboard.liveStatus.title': 'The World Cup is live - points are still waiting',
    'dashboard.liveStatus.text': 'Predictions are locked. Group-position points unlock only when a full group finishes all 6 matches.',
    'dashboard.liveStatus.reviewText': 'Your knockout review window is still open. Group-position points unlock only when a full group finishes all 6 matches.',
    'dashboard.liveStatus.lateKicker': 'LATE POOL',
    'dashboard.liveStatus.lateDeadline': 'Closes {time}',
    'dashboard.liveStatus.lateTitle': 'The World Cup is live - predictions are still open here',
    'dashboard.liveStatus.lateText': 'This is a late-entry pool. Invite friends and submit predictions until {time}. After that, registration and editing close for everyone.',
    'dashboard.liveStatus.progress': '{done}/{total} group matches finished',
    'dashboard.liveStatus.groups': '{done}/{total} groups finalized',
    'pundit.title': 'The Pundit',
    'pundit.badge.confirmed': 'Confirmed',
    'pundit.badge.reported': 'Reported',
    'pundit.badge.pool': 'Your pool',
    'pundit.source': 'Source:',
    'pundit.seeMore': 'See more',
    'pundit.seeLess': 'See less',
    'dashboard.your': 'Your Pool',
    'dashboard.points': 'Points',
    'dashboard.rank': 'Rank',
    'dashboard.position': 'on leaderboard',
    'dashboard.poolCode': 'Pool code',
    'dashboard.share': 'Share',
    'dashboard.myRank': 'Your rank',
    'dashboard.myBets': 'My predictions',
    'dashboard.status.groups': 'Group stage',
    'dashboard.status.knockout': 'Knockout stage',
    'dashboard.status.topScorer': 'Top scorer',
    'dashboard.status.notStarted': "Haven't started yet",
    'dashboard.status.partialGroups': 'Picked {n} of 32',
    'dashboard.status.completedGroups': 'Done · 32 teams',
    'dashboard.status.afterGroups': 'Opens after group stage',
    'dashboard.status.koReady': 'Ready to predict 31 matches',
    'dashboard.status.partialKo': 'Picked {n} of 31',
    'dashboard.status.completedKo': 'Done · 31 matches',
    'dashboard.status.topScorerLocked': 'Opens soon',
    'dashboard.action.start': 'Start',
    'dashboard.action.continue': 'Continue',
    'dashboard.action.edit': 'Edit',
    'dashboard.invite.title': 'Invite friends — they join in one click',
    'dashboard.invite.subtitle': 'Share the link in any app',
    'dashboard.invite.lateTitle': 'Invite friends before registration closes',
    'dashboard.invite.lateSubtitle': 'Registration and predictions are open until {time}',
    'dashboard.quickAction.leaderboard': 'Leaderboard',
    'dashboard.quickAction.help': 'Help',
    
    'dashboard.menu.title': 'Menu',
    'dashboard.role.member': 'Member',
    'dashboard.role.adminMember': 'Admin & Member',
    'dashboard.fallback.nickname': 'User',
    'dashboard.fallback.poolName': 'Pool',
    'dashboard.menu.invite': 'Invite friends to pool',
    'dashboard.menu.myInfo': 'My info',
    'dashboard.menu.showRecovery': 'Show recovery code',
    'dashboard.menu.members': 'Members list',
    'dashboard.menu.leaderboard': 'Leaderboard',
    'dashboard.menu.matches': 'Match schedule',
    'dashboard.menu.bracket': 'Bracket',
    'dashboard.menu.topScorer': 'Top Scorer',
    'dashboard.menu.help': 'Help & FAQ',
    'dashboard.menu.admin': 'Admin area',
    'dashboard.menu.manageMembers': 'Manage members',
    'dashboard.menu.settings': 'Pool settings',
    'dashboard.menu.preferences': 'Preferences',
    'dashboard.menu.language': 'Language',
    'dashboard.menu.leave': 'Leave pool',
    
    'dashboard.action.groups': 'Group Stage Predictions',
    'dashboard.action.groups.desc': 'Pick which teams will advance to knockout',
    'dashboard.action.knockout': 'Knockout Predictions',
    'dashboard.action.knockout.desc': 'Predict winners of the 32 advancing teams',
    'dashboard.action.topScorer': 'Top Scorer',
    'dashboard.action.topScorer.desc': 'Pick who will score the most goals',
    'dashboard.action.simulator': 'Risk Simulator',
    'dashboard.action.simulator.desc': 'Plan your strategy with underdog bets',
    
    'dashboard.poolLocked': 'Pool locked - predictions cannot be changed',
    'dashboard.poolLockedShort': 'Locked',
    
    // === Group Betting ===
    'groups.title': 'Group Stage Predictions',
    'groups.group': 'Group',
    'groups.pickInstructions': 'Pick 2 or 3 teams from this group',
    'groups.advance': 'will advance to knockout',
    'groups.tier.favorite': 'Favorite',
    'groups.tier.contender': 'Contender',
    'groups.tier.underdog': 'Underdog',
    'groups.tier.favorite.multi': '×1',
    'groups.tier.contender.multi': '×1.5',
    'groups.tier.underdog.multi': '×2',
    'groups.minPicks': 'Pick at least 2',
    'groups.maxReached': 'You already picked 3 teams. Remove one to add more',
    'groups.finishBetting': 'Finish predictions',
    'groups.nextGroup': 'Group',
    'groups.completed': 'You completed all groups!',
    'groups.savingPicks': 'Saving...',
    'groups.savedPicks': 'Saved ✓',
    'groups.picksSaved': 'Predictions saved',
    'bracketSave.noCode': 'Couldn\'t save — sign in again with your recovery code so your bracket sticks',
    'bracketSave.retryLater': 'Server is briefly unreachable. Your picks are backed up and will auto-restore — please refresh in a moment',

    // === Knockout ===
    'knockout.title': 'Knockout Predictions',
    'knockout.r32': 'Round of 32',
    'knockout.r16': 'Round of 16',
    'knockout.qf': 'Quarter-Finals',
    'knockout.sf': 'Semi-Finals',
    'knockout.final': 'Final',
    'knockout.pickWinner': 'Pick the winner',
    'knockout.tbd': 'TBD',
    // v2.5.79: third-place advancers selector
    'thirdPlace.title': 'Which 8 third-place teams advance?',
    'thirdPlace.subtitle': 'At WC 2026 the 8 best third-placed teams advance. Pick which 8 you think go through — they\'ll be slotted into the Round of 32 automatically.',
    'thirdPlace.selectExactly': 'Pick exactly 8 third-place teams ({n} selected)',
    'thirdPlace.maxReached': '8 already selected — remove one to pick another',
    'thirdPlace.vs': 'vs',
    'thirdPlace.pointsEach': 'Each correct pick = {pts} points',
    
    // === Top Scorer ===
    'topScorer.title': 'Top Scorer',
    'topScorer.heroTitle': 'Predict the Top Scorer',
    'topScorer.heroDesc': 'Who will score the most goals at the World Cup?',
    'topScorer.heroBonus': '+10 bonus points',
    'topScorer.heroBonusEnd': 'if you predict correctly!',
    'topScorer.searchPlaceholder': 'Search player (English only)...',
    'topScorer.hintsTitle': '💡 Search examples:',
    'topScorer.hintsNote': 'Search by player name, partial name, or team code (3 letters)',
    'topScorer.teamSuffix': '(team)',
    'page.title': 'FriendlyBet — Free World Cup 2026 Prediction Pool & Bracket Predictor',
    'page.description': 'FriendlyBet is a free World Cup 2026 prediction pool and bracket predictor you play with friends. Predict every group, the full knockout bracket and the top scorer, then climb a live leaderboard. No ads, no money, no sign-up. Open source.',
    'topScorer.team': 'Team',
    'topScorer.noResults': 'No players found',
    'topScorer.tryOther': 'Try a different name',
    'topScorer.yourPick': 'Your pick:',
    'topScorer.changePick': 'Change pick',
    'topScorer.clearPick': 'Clear pick',
    'topScorer.confirmChange': 'Change your pick?',
    'topScorer.picked': 'You picked ',
    'topScorer.cleared': 'Pick cleared',
    'topScorer.star': 'Star',
    'topScorer.locked.title': 'Top Scorer opens soon',
    'topScorer.locked.desc': 'Waiting for official squad lists from FIFA',
    'topScorer.locked.daysUntil': 'days until World Cup starts',
    'topScorer.locked.lastCheck': 'Last check',
    
    // === Risk Simulator ===
    'simulator.title': 'Risk Simulator',
    'simulator.desc': 'Plan your strategy',
    'simulator.totalBets': 'Total picks',
    'simulator.expectedPoints': 'Expected points',
    'simulator.byTier': 'By tier:',
    'simulator.recommendation': 'Recommendation',
    
    // === Leaderboard ===
    'leaderboard.title': 'Leaderboard',
    'leaderboard.rank': 'Rank',
    'leaderboard.player': 'Player',
    'leaderboard.points': 'Points',
    'leaderboard.groups': 'Groups',
    'leaderboard.knockout': 'Knockout',
    'leaderboard.bonus': 'Bonus',
    'leaderboard.total': 'Total',
    'leaderboard.notStarted': 'Not started yet',
    'leaderboard.partial': 'Made',
    'leaderboard.partialPicks': 'picks',
    'leaderboard.complete': 'Completed groups',
    'leaderboard.you': '(you)',
    'leaderboard.empty': 'No participants',
    'leaderboard.joinedToday': 'Joined today',
    'leaderboard.joinedYesterday': 'Joined yesterday',
    'leaderboard.joinedDaysAgo': 'Joined {n} days ago',
    'leaderboard.joinedOn': 'Joined on {date}',
    'leaderboard.fullRanking': 'Full ranking',
    'leaderboard.emptyTitle': 'Tournament hasn\'t started yet',
    'leaderboard.emptyText': 'Scores will be calculated after matches begin',
    'leaderboard.participantsCount': '{n} participants',
    'leaderboard.statusBefore': 'Before tournament starts',
    'leaderboard.statusDuring': 'Tournament in progress',
    'leaderboard.podiumEmpty': 'Empty',
    'leaderboard.noPointsYet': 'No points yet',
    'leaderboard.loadError': 'Failed to load leaderboard',
    'leaderboard.shareText': '🏆 Leaderboard for {poolName}!\n\nJoin FriendlyBet and compete with us on World Cup 2026:\n{url}',

    // Pool Pundit — live leaderboard banter
    'leaderboard.banter.title': 'Pool Pundit',
    'leaderboard.banter.live': 'live',
    'leaderboard.banter.share': 'Share this moment',
    'leaderboard.banter.caption': '🎙️ What\'s happening in {pool}? Catch the live drama from our FriendlyBet pool:',
    'leaderboard.banter.cardTitle': 'Pool Buzz',
    'leaderboard.banter.cardStandings': 'Top of the table',
    'leaderboard.banter.cardScan': 'Scan for the bracket',
    'leaderboard.banter.cardTagline': 'Free · no signup · join the pool',

    // === Matches ===
    'matches.title': 'Match Schedule',
    'matches.filter.all': 'All',
    'matches.filter.live': 'Live',
    'matches.filter.today': 'Today',
    'matches.filter.upcoming': 'Upcoming',
    'matches.empty': 'No matches to display',
    'matches.live': 'LIVE',
    'matches.finished': 'Final',
    'matches.scheduled': 'Scheduled',
    'matches.matchNum': 'Match',
    'matches.youPredicted': 'Your pick:',
    'matches.correctPrediction': 'Correct! +{n} pts',
    'matches.wrongPrediction': 'Wrong prediction',
    
    // === Bracket ===
    'bracket.title': 'Bracket',
    'bracket.r16': 'Round of 16',
    'bracket.qf': 'Quarter-Finals',
    'bracket.sf': 'Semi-Finals',
    'bracket.final': 'Final',
    'bracket.champion': 'Champion',
    
    // === Members ===
    'members.title': 'Members',
    'members.count': '{n} members',
    'members.pending': '{n} pending approval',
    'members.empty': 'No members yet',
    
    // === Admin ===
    'admin.title': 'Admin area',
    'admin.members.title': 'Manage Members',
    'admin.members.total': 'Total',
    'admin.members.pending': 'Pending',
    'admin.members.complete': 'Completed',
    'admin.members.approve': 'Approve',
    'admin.members.reject': 'Remove',
    'admin.members.pendingBadge': '⏳ Pending approval',
    'admin.members.poolLocked': 'Pool locked - cannot approve/reject',
    'admin.member.actions': 'Actions',
    'admin.member.generateCode': 'Generate new recovery code',
    'admin.member.remove': 'Remove from pool',
    'admin.member.confirmRemove': 'Remove {name} from the pool?',
    'admin.member.removed': 'Member removed',
    'admin.member.approved': 'Member approved',
    'admin.member.rejected': 'Member removed',
    
    'admin.settings.title': 'Pool Settings',
    'admin.settings.poolStatus': 'Pool Status',
    'admin.settings.locked': 'Locked',
    'admin.settings.unlocked': 'Open',
    'admin.settings.lockBtn': 'Lock pool',
    'admin.settings.unlockBtn': 'Unlock pool',
    'admin.settings.lockDesc': 'When locked - predictions can\'t be changed. New member approval disabled.',
    'admin.settings.scoring': 'Scoring',
    'admin.settings.scoring.groups': 'Group stage (per correct pick)',
    'admin.settings.scoring.r32': 'Round of 32',
    'admin.settings.scoring.r16': 'Round of 16',
    'admin.settings.scoring.qf': 'Quarter-Finals',
    'admin.settings.scoring.sf': 'Semi-Finals',
    'admin.settings.scoring.final': 'Final',
    'admin.settings.scoring.topScorer': 'Top Scorer',
    'admin.settings.reset': 'Reset to default',
    'admin.settings.confirmReset': 'Reset scoring to default?',
    
    // === Sharing / Invite ===
    'invite.title': 'Invite friends to pool',
    'invite.desc': 'Share this link to invite friends',
    'invite.code': 'Pool code',
    'invite.link': 'Invite link',
    'invite.whatsapp': 'WhatsApp',
    'invite.telegram': 'Telegram',
    'invite.qr': 'QR',
    'invite.copy': 'Copy',
    'invite.shareText': 'Join my World Cup prediction pool!',
    
    // === Help ===
    'help.title': 'Help & FAQ',
    'help.intro': 'FriendlyBet is a social World Cup prediction game',
    
    // === Toasts / Messages ===
    'toast.poolCreated': 'Pool created successfully!',
    'toast.joined': 'Joined successfully',
    'toast.loginSuccess': 'Logged in successfully',
    'toast.invalidCode': 'Invalid code',
    'toast.poolNotFound': 'Pool not found',
    'toast.copyError': 'Copy failed',
    'toast.copied': 'Copied to clipboard',
    'toast.recoveryNew': 'New recovery code generated',
    'toast.offline': 'You are offline',
    'toast.online': 'Back online',
    'toast.poolLocked': 'Pool locked',
    'toast.poolUnlocked': 'Pool unlocked',
    'toast.loadError': 'Failed to load',
    
    // === Confirmations ===
    'confirm.leave': 'Leave the pool?',
    'confirm.leaveDesc': 'You can return with your recovery code.',
    'confirm.alreadyInPool': 'You\'re already in another pool',
    'confirm.alreadyInPoolDesc': 'To join {name}, you must leave your current pool first.',
    
    // === Dates / Time ===
    'date.today': 'Today',
    'date.tomorrow': 'Tomorrow',
    'date.yesterday': 'Yesterday',
    'date.months': ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    'date.monthsShort': ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    'date.weekdays': ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    
    // === Country Names ===
    'country.ARG': 'Argentina',
    'country.BRA': 'Brazil',
    'country.FRA': 'France',
    'country.ENG': 'England',
    'country.ESP': 'Spain',
    'country.POR': 'Portugal',
    'country.NED': 'Netherlands',
    'country.GER': 'Germany',
    'country.BEL': 'Belgium',
    'country.CRO': 'Croatia',
    'country.URU': 'Uruguay',
    'country.USA': 'USA',
    'country.MEX': 'Mexico',
    'country.SUI': 'Switzerland',
    'country.AUT': 'Austria',
    'country.SWE': 'Sweden',
    'country.SEN': 'Senegal',
    'country.MAR': 'Morocco',
    'country.JPN': 'Japan',
    'country.KOR': 'South Korea',
    'country.AUS': 'Australia',
    'country.CAN': 'Canada',
    'country.TUR': 'Turkey',
    'country.NOR': 'Norway',
    'country.IRN': 'Iran',
    'country.TUN': 'Tunisia',
    'country.EGY': 'Egypt',
    'country.GHA': 'Ghana',
    'country.PAN': 'Panama',
    'country.PAR': 'Paraguay',
    'country.NZL': 'New Zealand',
    'country.UZB': 'Uzbekistan',
    'country.IRQ': 'Iraq',
    'country.SAU': 'Saudi Arabia',
    'country.JOR': 'Jordan',
    'country.RSA': 'South Africa',
    'country.ALG': 'Algeria',
    'country.CZE': 'Czechia',
    'country.HAI': 'Haiti',
    'country.BIH': 'Bosnia',
    'country.CPV': 'Cape Verde',
    'country.COD': 'DR Congo',
    'country.CIV': 'Ivory Coast',
    'country.QAT': 'Qatar',
    'country.SCO': 'Scotland',
    'country.CUR': 'Curaçao',
    'country.ECU': 'Ecuador',
    'country.COL': 'Colombia',

    // === Feedback / Contact us ===
    'feedback.menuItem': 'Send feedback',
    'feedback.title': 'Send us feedback',
    'feedback.subtitle': "We'd love to hear what we can improve.",
    'feedback.cat.idea': 'Idea',
    'feedback.cat.bug': 'Bug',
    'feedback.cat.praise': 'Praise',
    'feedback.cat.other': 'Other',
    'feedback.placeholder': "Tell us what's on your mind...",
    'feedback.emailPlaceholder': 'Email for a reply (optional)',
    'feedback.submit': 'Send',
    'feedback.close': 'Close',
    'feedback.thanksTitle': 'Thank you! 🙌',
    'feedback.thanksText': 'Your feedback was received and helps us improve.',
    'feedback.emptyError': 'Write a message before sending',
    'feedback.sendError': 'Sending failed, please try again',

    // === Extended common ===
    'common.tournament': 'Tournament',
    'common.tournamentName': 'World Cup 2026',
    'common.status': 'Status',
    'common.matches': 'matches',
    'common.members': 'members',
    'common.minutes': 'minutes',
    'common.hours': 'hours',
    'common.justNow': 'just now',
    'common.refresh': 'Refresh',
    'common.zoom': 'Zoom',
    'common.invite': 'Invite',
    'common.saveExit': 'Save & exit',
    'common.simulator': 'Simulator',
    'common.processing': 'Processing...',

    // === PWA install banner ===
    'pwa.title': 'Install the app',
    'pwa.text': 'Quick access from home screen, no browser',
    'pwa.install': 'Install',
    'pwa.installed': '🎉 App installed!',
    'pwa.installing': '🎉 Installing...',
    'pwa.iosInstructions': 'To install on iPhone/iPad:\n\n1. Tap the share button ⎙ below\n2. Scroll and choose "Add to Home Screen"\n3. Tap "Add"\n\nThe app will appear on your home screen like a normal app!',
    'pwa.desktopInstructions': 'To install the app:\n\n• Chrome/Edge: An "Install" button appears in the address bar\n• Firefox: Tap the three dots → "Install"\n• Or add to bookmarks',
    'pwa.updateAvailable': '🔄 New version available',
    'pwa.update': 'Update',
    'pwa.online': '🌐 Back online',
    'pwa.offline': 'No internet — some features are limited',

    // === Pool found screen ===
    'poolFound.title': 'Pool details',
    'poolFound.membersValue': '{n} members',
    'poolFound.statusOpen': 'Open to join',
    'poolFound.statusLateOpen': 'Open to join until {time}',
    'poolFound.statusGroupLocked': 'Group stage closed',
    'poolFound.statusKnockout': 'In knockout stage',
    'poolFound.statusFinished': 'Finished',

    // === Nickname screen ===
    'nickname.step': 'Step 1 of 2',
    'nickname.title': 'What should we call you?',
    'nickname.subtitle': 'Your nickname appears on the leaderboard',
    'nickname.placeholder': 'e.g. Danny',
    'nickname.checking': 'Checking availability...',
    'nickname.taken': 'Nickname taken, try another',
    'nickname.available': 'Nickname available!',
    'nickname.errorRequired': 'Please enter a nickname',
    'nickname.errorMin': 'Nickname must be at least {n} characters',
    'nickname.errorMax': 'Nickname must be at most {n} characters',
    'nickname.errorTaken': 'Nickname already taken in this pool',

    // === Recovery code creation ===
    'recoveryCode.step': 'Step 2 of 2',
    'recoveryCode.sendSelf': 'Send to myself',
    'recoveryCode.warningTitle': 'Important!',
    'recoveryCode.warningText': 'Without this code you cannot log back in. Keep it safe.',
    'recoveryCode.saved': 'Saved, continue',
    'recoveryCode.shareText': '🔑 My recovery code for {poolName}:\n\n{code}\n\n⚠️ Keep this message — you\'ll need the code to log back in!\n\n{url}',
    'recoveryCode.copiedSave': 'Recovery code copied! Keep it safe',
    'recoveryCode.copied': 'Recovery code copied!',

    // === Create pool ===
    'createPool.step1': 'Step 1 of 3',
    'createPool.title1': 'What should we call the pool?',
    'createPool.subtitle1': 'The name everyone will see',
    'createPool.placeholder': 'e.g. Coworkers',
    'createPool.suggestions': 'Quick suggestions:',
    'createPool.suggestion1': 'The Family Cup',
    'createPool.suggestion2': 'The Office Cup',
    'createPool.suggestion3': 'Office Bracket Wars',
    'createPool.suggestion4': 'Work Friends FC',
    'createPool.suggestion5': 'Friendly World Cup Challenge',
    'createPool.suggestion6': 'Friends With Brackets',
    'createPool.suggestion7': 'Wannabe Experts',
    'createPool.suggestion8': 'Mundial 2026',
    'createPool.suggestion9': 'The Underdogs',
    'createPool.suggestion10': 'Geniuses of the 2026 World Cup',
    'createPool.errorRequired': 'Please enter a pool name',
    'createPool.errorMin': 'Name must be at least {n} characters',

    // === Admin nickname ===
    'adminNickname.step': 'Step 2 of 3',
    'adminNickname.subtitle': 'Your nickname — as admin AND member',
    'adminNickname.placeholder': 'e.g. John',
    'adminNickname.permTitle': 'Admin permissions',
    'adminNickname.perm1': 'Manage pool members',
    'adminNickname.permRules': 'Set the betting rules',
    'adminNickname.perm2': 'Approve new users',
    'adminNickname.perm3': 'Recover lost codes',
    'adminNickname.perm4': 'View all predictions',
    'adminNickname.perm5': 'You also participate in the pool',
    'adminNickname.errorRequired': 'Please enter your nickname',
    'adminNickname.createBtn': 'Create pool',

    // === Share pool ===
    'sharePool.created': 'Pool created!',
    'sharePool.awesome': 'Awesome!',
    'sharePool.subtitle': 'Pool created successfully',
    'sharePool.promptTitle': 'Pool created with Golazo rules (default)',
    'sharePool.promptSubtitle': 'You can edit all rules before anyone joins',
    'sharePool.editSettings': 'Edit settings',
    'sharePool.divider': 'Or just share and start playing',
    'sharePool.whatsapp': 'Share on WhatsApp',
    'sharePool.telegram': 'Share on Telegram',
    'sharePool.copyLink': 'Copy link',
    'sharePool.toDashboard': 'To my dashboard',
    'sharePool.welcomeToast': 'Welcome to {name}!',
    'sharePool.adminCodeAlert': '🔑 Your admin recovery code:\n\n{code}\n\nKeep it safe! Without it you cannot log back in.',
    'sharePool.shareText': 'You\'ve been invited to the "{poolName}" pool 🏆\n\nLet\'s predict World Cup 2026 together.\n\nJoin code: {code}\n👉 {url}\n\n⚽ FriendlyBet — World Cup Predictions with Friends',
    'sharePool.shareTextLate': 'You\'ve been invited to the late-entry "{poolName}" pool 🏆\n\nThe World Cup has already started, but this pool still accepts members and predictions until {time}.\n\nJoin code: {code}\n👉 {url}\n\n⚽ FriendlyBet — World Cup Predictions with Friends',
    'bracketShare.cta': 'Share my bracket',
    'bracketShare.caption': 'My World Cup 2026 bracket on FriendlyBet 🏆 Free, no signup — build your own',
    'bracketShare.toastDesktop': 'Image downloaded & caption copied — upload it to your social app',
    'bracketShare.notReady': 'Finish your bracket (including the champion) first',
    'bracketShare.celebrateTitle': '🏆 Your bracket is saved!',
    'bracketShare.done': 'Done — back to dashboard',
    'bracketShare.orChoose': 'Or share via an app',
    'bracketShare.shareToApps': 'Shareable to every app',
    'bracketShare.desktopTitle': 'Share your bracket',
    'bracketShare.desktopSub': 'Copy the link or pick an app — friends who open it see your full bracket',
    'bracketShare.imageFirstHint': 'Image downloaded — attach it to your post (link copied too)',
    'bracketShare.copyLink': 'Copy link',
    'bracketShare.linkCopied': 'Link copied! 🔗',
    'bracketShare.downloadImage': 'Download image',
    'bracketShare.redditTitle': 'My World Cup 2026 bracket 🏆',
    'bracketShare.emailSubject': 'My World Cup 2026 bracket on FriendlyBet',
    'bracketShare.igHint': 'Image downloaded — open Instagram and post it to your story',

    // === Pool settings ===
    'poolSettings.lockedTitle': 'Rules locked',
    'poolSettings.lockedText': 'Members already joined — rules cannot be changed',
    'poolSettings.poolInfo': 'Pool info',
    // v2.5.7: v2 (single_phase) pool settings sections
    'poolSettings.bettingMode': 'Betting mode',
    'poolSettings.bettingModeLabel': 'Mode',
    'poolSettings.bettingModeHelp': 'Single-phase: groups + knockout + top scorer, all picked before the tournament starts.',
    'poolSettings.scoringReadOnly': 'Scoring rules are locked at pool creation and cannot be changed.',
    'poolSettings.poolName': 'Pool name',
    'poolSettings.poolCode': 'Pool code',
    'poolSettings.poolMembers': 'Members',
    'poolSettings.format': 'Pool format',
    'poolSettings.stages': 'Number of stages',
    'poolSettings.stages2': '2 stages',
    'poolSettings.stages6': '6 stages',
    'poolSettings.help2': '2 stages: Groups + Knockout',
    'poolSettings.help6': '6 stages: Groups + R32 + R16 + QF + SF + Final',
    'poolSettings.groupBetting': 'Group betting style',
    'poolSettings.pickAdvancing': 'Pick advancing',
    'poolSettings.fullRanking': 'Rank 1-4',
    'poolSettings.helpPickAdvancing': 'Pick 2-3 teams to advance from each group',
    'poolSettings.helpFullRanking': 'Full ranking of all teams in the group',
    'poolSettings.multipliers': 'Risk multipliers',
    'poolSettings.multipliersActive': 'Multipliers active',
    'poolSettings.multipliersHelp': 'Risk more — earn more 🎲',
    'poolSettings.multFav': 'Favorite',
    'poolSettings.multCont': 'Contender',
    'poolSettings.multUnd': 'Underdog',
    'poolSettings.scoring': 'Points per stage',
    'poolSettings.scoreGroupStage': 'Group stage',
    'poolSettings.scoreR32': 'Round of 32',
    'poolSettings.scoreR16': 'Round of 16',
    'poolSettings.scoreQF': 'Quarter-Finals',
    'poolSettings.scoreSF': 'Semi-Finals',
    'poolSettings.scoreFinal': 'Final',
    'poolSettings.resetGolazo': 'Reset to Golazo rules',
    'poolSettings.topScorer': 'Top Scorer',
    'poolSettings.topScorerActive': 'Active',
    'poolSettings.bonusPoints': 'Bonus points',
    'poolSettings.members': 'Members',
    'poolSettings.limitMembers': 'Limit members',
    'poolSettings.maxMembers': 'Max members',
    'poolSettings.approveBefore': 'Approve users before betting',
    'poolSettings.approveBeforeHelp': 'Anti-bot protection — approve each member manually before they can bet',
    'poolSettings.saveBtn': 'Save settings',
    'poolSettings.dangerZone': 'Danger zone',
    'poolSettings.deletePool': 'Delete pool',
    'poolSettings.deleteHelp': 'Deletion is irreversible. All data will be lost forever.',
    'poolSettings.savingToast': 'Saving settings...',
    'poolSettings.savedToast': 'Settings saved! ✅',
    'poolSettings.saveError': 'Save failed: {msg}',
    'poolSettings.poolNameShort': 'Pool name too short',
    'poolSettings.notAdmin': 'Only the admin can edit settings',
    'poolSettings.loadError': 'Failed to load settings',
    'poolSettings.notFound': 'Pool not found',
    'poolSettings.resetToast': 'Reset to original Golazo rules',
    'poolSettings.bonusToast': 'Top scorer bonus: {n} points',
    'poolSettings.deleteWarning': '⚠️ Warning!\n\nYou are about to delete the pool "{name}".\n\nAll data, predictions and scores will be permanently lost.\n\nThis cannot be undone.\n\nContinue?',
    'poolSettings.deletePrompt': 'To confirm, type the pool name:\n"{name}"',
    'poolSettings.deleteCancelled': 'Deletion cancelled',
    'poolSettings.deleteError': 'Deletion failed: {msg}',
    'poolSettings.deletedToast': 'Pool deleted',
    'poolSettings.leaveConfirm': 'Leave the pool?\n\nYour code still works — you can log back in with the recovery code.',
    'poolSettings.leftToast': 'You left the pool',

    // === Group betting ===
    'groups.titleGroup': 'Group {letter}',
    'groups.stepProgress': 'Group {current} of {total}',
    'groups.totalPicks': 'Total picks',
    'groups.questionHeader': 'Who advances from group',
    'groups.subtitleInline': 'Pick 2 or 3 teams to advance',
    'groups.quickJump': 'Quick jump to group',
    'groups.prevGroup': 'Group {letter}',
    'groups.nextGroup': 'Group {letter}',
    'groups.saveAndNext': 'Save & next group',
    'groups.tierFavorite': '⭐ Favorite ×1',
    'groups.tierContender': '⚔️ Contender ×1.5',
    'groups.tierUnderdog': '🐶 Underdog ×2',
    'groups.pointsForPosition': '#{pos}: {pts} pts',
    'groups.multStartsKO': 'Risk multipliers kick in from the knockout stage',
    'groups.pointsPerAdvancingTeam': 'Each advancing team: {pts} pts × its risk multiplier',
    'groups.tooltipAdvanced': 'Team advanced!',
    'groups.tooltipEliminated': 'Team eliminated',
    'groups.maxReachedToast': 'Already picked 3 teams. Remove one before adding another',
    'groups.maxTotalReached': 'You’ve picked 32 advancing teams — the maximum. Remove one before adding another',
    'groups.pickSubtitleDefault': 'Pick 2 or 3 teams from this group',
    'groups.pickOneOnly': '⚠️ You picked only 1 — need 2 or 3',
    'groups.pickedTwo': '✓ Picked 2 teams in this group',
    'groups.pickedThree': '✓ Picked 3 teams in this group',
    'groups.validationRemaining': '{n} more teams to pick',
    'groups.validationDone': '🎉 Done! 32 teams picked',
    'groups.validationProblem': 'Issue: at least one group has 0 or 1 picks',
    'groups.validationTooMany': 'Too many! {n} over the max',
    'groups.needMore': 'Pick {n} more team{plural} to continue',
    'groups.mustPickTwo': 'You must pick at least 2 teams in group {letter} to continue',
    'groups.saveError': 'Failed to save predictions',
    'groups.savedOk': 'Saved ✓',
    'groups.exitConfirm': 'You have {n} saved picks. Exit without finishing?',
    'groups.exactly32': 'Need exactly 32 teams (you have {n})',
    'groups.eachGroup2or3': 'Each group must have 2 or 3 teams',
    'groups.savingToast': 'Saving predictions...',
    'groups.loadingTeams': 'Loading teams...',
    'groups.teamsSyncing': 'Teams still syncing — try again in a few minutes',

    // === Betting complete ===
    'complete.title': 'Great job!',
    'complete.subtitle': 'You completed group-stage predictions',
    'complete.teamsPicked': 'Teams picked',
    'complete.maxPoints': 'Max possible score',
    'complete.info': 'Saved. You can edit until the first match',
    'complete.toDashboard': 'Go to dashboard',
    'complete.review': 'Review my picks',

    // === Knockout extras ===
    'knockoutEx.r32Short': 'R32',
    'knockoutEx.r16Short': 'R16',
    'knockoutEx.qfShort': 'QF',
    'knockoutEx.sfShort': 'SF',
    'knockoutEx.finalShort': 'Final',
    'knockoutEx.r32Full': 'Round of 32',
    'knockoutEx.r16Full': 'Round of 16',
    'knockoutEx.qfFull': 'Quarter-Finals',
    'knockoutEx.sfFull': 'Semi-Finals',
    'knockoutEx.finalFull': 'Final',
    'knockoutEx.pointsPerPick': '{n} points per correct pick',
    'knockoutEx.totalPicks': 'Total picks',
    'knockoutEx.emptyTitle': 'This round opens later',
    'knockoutEx.emptyText': 'Complete earlier rounds first',
    'knockoutEx.finishBtn': 'Finish knockout',
    'knockoutEx.bracketView': 'Bracket view',
    'knockoutEx.matchNum': 'Match {n}',
    'knockoutEx.finalLabel': 'Final 🏆',
    'knockoutEx.winnerLine': 'Winner: <strong>World Cup champion!</strong>',
    'knockoutEx.correctLine': 'Correct! +{n} pts',
    'knockoutEx.wonLine': '{name} won',
    'knockoutEx.opponent': 'opponent',
    'knockoutEx.equalizer': 'matches',
    'knockoutEx.pointsValue': '{n} pts',
    'knockoutEx.ifCorrect': 'if you pick correctly',
    'knockoutEx.tbdTeam': 'TBD',
    'knockoutEx.savedOk': 'Knockout picks saved ✓',
    'knockoutEx.completed': 'Knockout predictions complete! 🏆',
    'knockoutEx.needGroups': 'Finish the group stage first (32 teams)',
    'knockoutEx.loadingKO': 'Loading knockout stage...',
    'knockoutEx.loadError': 'Failed to load teams',
    'knockoutEx.matchesProgress': '{n}/31 matches',

    // === Bracket view ===
    'bracketView.title': 'Bracket',
    'bracketView.full': 'Full view',
    'bracketView.leftSide': 'Left half',
    'bracketView.rightSide': 'Right half',
    'bracketView.scrollHint': '↔ Scroll sideways to see both halves',
    'bracketView.scrollChip': '↔ scroll to see all',
    'bracketView.hint': 'Swipe to see all rounds',
    'bracketView.r32': 'R32',
    'bracketView.r16': 'R16',
    'bracketView.qf': 'QF',
    'bracketView.sf': 'SF',
    'bracketView.final': '🏆 Final',
    'bracketView.championLabel': '🏆 Champion 🏆',
    'bracketView.tbd': 'TBD',

    // === Simulator ===
    'simulatorEx.titleFull': 'Risk Simulator',
    'simulatorEx.subtitle': 'Your strategy analysis',
    'simulatorEx.expectedScore': 'Expected score',
    'simulatorEx.avgProjection': 'Average projection',
    'simulatorEx.maxPossible': 'Max possible',
    'simulatorEx.riskLevel': 'Risk level',
    'simulatorEx.riskSafe': '🛡️ Safe',
    'simulatorEx.riskBalanced': '⚡ Balanced',
    'simulatorEx.riskRisky': '🎲 Risky',
    'simulatorEx.riskDefault': 'Pick matches to see analysis',
    'simulatorEx.byStage': 'Breakdown by stage',
    'simulatorEx.recommendDefault': 'Pick knockout matches to get recommendations',
    'simulatorEx.riskDescSafe': '🛡️ Safe strategy — picking the favorites',
    'simulatorEx.riskDescBalanced': '⚡ Balanced strategy — mix of safe and creative',
    'simulatorEx.riskDescRisky': '🎲 Aggressive strategy — lots of risky bets',
    'simulatorEx.riskDescVery': '🔥 All-in strategy — going for it!',
    'simulatorEx.recEarly': 'Start picking matches and the simulator will analyze your strategy',
    'simulatorEx.recContinue': 'Keep picking to see your full odds',
    'simulatorEx.recTooSafe': 'Safe strategies give steady scores but are hard to win with. Try 1-2 bolder picks.',
    'simulatorEx.recTooRisky': 'Very risky! Huge upside but high chance of mistakes. Consider safer picks in later rounds.',
    'simulatorEx.recBalanced': 'Excellent balance! High potential with moderate risk. Smart strategy.',

    // === Matches extras ===
    'matchesEx.filterUpcoming': 'Upcoming',
    'matchesEx.filterFinished': 'Finished',
    'matchesEx.filterLive': '🔴 Live',
    'matchesEx.live': 'Live',
    'matchesEx.liveUpdating': 'Live score updating',
    'matchesEx.finished': 'Final',
    'matchesEx.scoreAfterFinal': 'Score updates after full time',
    'matchesEx.verifyingResult': 'Verifying result',
    'matchesEx.resultBeingVerified': 'Final score is being verified now',
    // v2.5.37: live minute labels (client-computed from match_date)
    'matchesEx.minute': "{n}'",
    'matchesEx.halftime': 'Half-time',
    'matchesEx.extraTime': "ET · {n}'",
    'matchesEx.lastUpdated': 'Updated: {time}',
    'matchesEx.notSynced': 'Not synced yet',
    'matchesEx.emptyTitle': 'Matches not yet published',
    'matchesEx.emptyText': 'Schedule will update once FIFA publishes the official Draw',
    'matchesEx.loadingMatches': 'Loading matches...',
    'matchesEx.noInCategory': 'No matches in this category',
    'matchesEx.dateUnknown': 'Date unknown',
    'matchesEx.past': 'past',
    'matchesEx.inMinutes': 'in {n} minutes',
    'matchesEx.inHours': 'in {n} hours',
    'matchesEx.inDays': 'in {n} days',
    'matchesEx.minutesAgo': '{n} minutes ago',
    'matchesEx.hoursAgo': '{n} hours ago',
    'matchesEx.daysAgo': '{n} days ago',
    'matchesEx.syncing': 'Syncing matches...',
    'matchesEx.synced': 'Updated ✓',
    'matchesEx.loadError': 'Failed to load matches',
    'matchesEx.stageGroup': 'Group {letter}',
    'matchesEx.stageR16': 'Round of 16',
    'matchesEx.stageQF': 'Quarter-Finals',
    'matchesEx.stageSF': 'Semi-Finals',
    'matchesEx.stageFinal': '🏆 Final',
    'matchesEx.stageThird': '3rd place',

    // === Admin members ===
    'adminMembersEx.lockedTitle': 'Pool locked',
    'adminMembersEx.lockedText': 'No new members can join with the invite code',
    'adminMembersEx.unlockBtn': 'Unlock',
    'adminMembersEx.openTitle': 'Pool open to join',
    'adminMembersEx.openText': 'Members can join with the invite code',
    'adminMembersEx.lockBtn': 'Lock',
    'adminMembersEx.notAdmin': '🚫 Only the admin can access this area',
    'adminMembersEx.notAdminAction': '🚫 Only the admin can do that',
    'adminMembersEx.pendingCount': '<span id="admin-pending-count">{n}</span> members pending approval',
    'adminMembersEx.pendingSubtitle': 'They can play — but it\'s recommended to approve/remove them',
    'adminMembersEx.members': 'Members',
    'adminMembersEx.pickedGroups': 'Picked groups',
    'adminMembersEx.pickedKO': 'Picked knockout',
    'adminMembersEx.adminBadge': 'Admin ✓',
    'adminMembersEx.pendingBadge': '⏳ Pending approval',
    'adminMembersEx.approve': 'Approve',
    'adminMembersEx.remove': 'Remove',
    'adminMembersEx.groupsPicks': 'Groups: {n} {check}',
    'adminMembersEx.koPicks': 'Knockout: {n}/16 {check}',
    'adminMembersEx.startedYes': '✓ Started betting',
    'adminMembersEx.startedNo': '○ Not started',
    'adminMembersEx.finishedYes': '✓ Finished all',
    'adminMembersEx.finishedNo': '○ Not finished',
    'adminMembersEx.needsKnockout': 'Missing knockout',
    'adminMembersEx.annexReview': 'Should review knockout',
    'adminMembersEx.annexHardAffected': 'Must fix knockout',
    'adminMembersEx.annexNoIssue': 'No correction needed',
    'adminMembersEx.needsKnockoutCount': '{n} member(s) haven\'t filled the knockout stage — worth nudging them to finish before the World Cup starts',
    'adminMembersEx.needsKnockoutGlitch': '{n} member(s) still need to complete or verify their knockout bracket. Some may have been hit by a silent save issue, and some may simply be unfinished. They\'re flagged below.',
    'adminMembersEx.annexCReviewTitle': 'Important: your pool needs knockout review',
    'adminMembersEx.annexCReviewGlitch': 'We’re genuinely sorry. FriendlyBet showed some third-place teams in the wrong knockout matches for this pool. {hard} member(s) are directly affected because they have at least one pick for a matchup that no longer exists in the corrected bracket. To keep things fair, all {n} member(s) in this pool now have a review window to check or update their knockout bracket. Picks that don’t match the corrected official bracket may score 0 points.',
    'adminMembersEx.annexReviewExpires': 'Review window open until {time}, shown in each user’s local time',
    'adminMembersEx.annexYouHard': 'Your own bracket also has picks that must be fixed — please review it now.',
    'adminMembersEx.annexYouReview': 'You also have the correction window — please review your bracket.',
    'adminMembersEx.annexYouClear': 'Your own bracket is not directly flagged, but members in your pool need a reminder.',
    'adminMembersEx.copyNudge': 'Copy reminder for members',
    'adminMembersEx.viewAffectedMembers': 'View members',
    'adminMembersEx.reviewMyBracket': 'Review my bracket',
    'adminMembersEx.nudgeMessage': 'Hey everyone, we’re genuinely sorry. FriendlyBet corrected a mistake where some third-place teams were shown in the wrong knockout matches. Because of this, some knockout picks may now point to matchups that don’t exist in the corrected official bracket, and those picks may score 0 points. Please reopen friendlybet.live now and review or fix your knockout bracket. Group picks, third-place teams, and top scorer stay locked; only knockout picks are open during this review window. Thank you, and sorry for the hassle.',
    'adminMembersEx.nudgeCopied': 'Message copied! Paste it in your group 📋',
    'adminMembersEx.startedCount': 'Started',
    'adminMembersEx.finishedCount': 'Finished',
    'adminMembersEx.approvedToast': '✓ {name} approved',
    'adminMembersEx.approveError': 'Approval failed',
    'adminMembersEx.confirmRemoveAll': 'Remove {name} from the pool?\n\nAll their picks will be deleted.\nThis cannot be undone.',
    'adminMembersEx.removedToast': '{name} removed',
    'adminMembersEx.removeError': 'Removal failed',
    'adminMembersEx.confirmAction': 'Are you sure you want to {action} the pool?',
    'adminMembersEx.actionLock': 'lock',
    'adminMembersEx.actionUnlock': 'unlock',
    'adminMembersEx.poolLocked': '🔒 Pool locked',
    'adminMembersEx.poolUnlocked': '🔓 Pool unlocked',
    'adminMembersEx.toggleError': 'Failed to update pool state',
    'adminMembersEx.loadError': 'Failed to load members',
    'adminMembersEx.memberJoinedMeta': 'Joined {date} · {g} groups · {k} knockout',
    'adminMembersEx.confirmNewCode': 'Generate a new recovery code for {name}?\n\nThe old code is revoked immediately. You\'ll have to send the new code yourself.',
    'adminMembersEx.newCodeMsg': '✅ New recovery code for {name}:\n\n{code}\n\n📋 The code will be copied to your clipboard when you tap OK.\nSend it to {name} privately.\n\n⚠️ The old code is revoked and will no longer work.',
    'adminMembersEx.newCodeError': 'Failed to generate code',
    'adminMembersEx.newCodeCopied': '🔑 New code generated and copied',
    // v2.5.36: admin share new code modal
    'adminShareCode.title': 'New recovery code ready',
    'adminShareCode.subtitle': 'Send the code to {name} on WhatsApp or Telegram, or copy the direct link',
    'adminShareCode.codeLabel': 'New code',
    'adminShareCode.message': 'Hey {name}! Your access code for "{pool}" was reset. Recovery code: {code}\nOr just open this link: {link}',
    'adminShareCode.linkCopied': '✓ Link copied',
    'adminMembersEx.confirmDeleteFull': '⚠️ Are you sure you want to remove {name} from the pool?\n\nThis will delete:\n- All their picks ({g} groups, {k} knockout)\n- Their account entirely\n\nThis cannot be undone.',
    'adminMembersEx.finalConfirm': 'Final confirmation — remove {name}?',
    'adminMembersEx.finalRemovedToast': '✓ {name} removed from pool',
    'adminMembersEx.finalRemoveError': 'Failed to remove member',

    // === Admin modal ===
    'adminModal.newCodeTitle': 'Generate new recovery code',
    'adminModal.newCodeText': 'Old code will be revoked',
    'adminModal.removeTitle': 'Remove from pool',
    'adminModal.removeText': 'This will delete all their picks',

    // === Share modal ===
    'shareModal.title': 'Invite friends',
    'shareModal.subtitle': 'Send them the link and they join in one tap',
    'shareModal.oneClick': 'Join in one click — no signup, no app to install',
    'shareModal.shareWithFriends': 'Share with friends',
    'shareModal.copyForDesktop': 'Copy invite link',
    'shareModal.orChoose': 'Or pick an app',
    'shareModal.email': 'Email',
    'shareModal.sms': 'SMS',
    'shareModal.igCopied': 'Link copied — paste it into your Instagram story or DM',
    'shareModal.emailSubject': 'Invitation to the "{poolName}" pool on FriendlyBet',
    'shareModal.copyHint': 'Tap to copy',
    'shareModal.copyLink': 'Copy link',
    'shareModal.shareMsg': 'Share with message',
    'shareModal.scanCode': 'Or scan the code below:',
    'shareModal.inviteUrl': 'Invite link:',
    'shareModal.generatingQR': 'Generating QR code...',
    'shareModal.copyLinkOk': '✓ Link copied!',
    'shareModal.copyCodeOk': '✓ Code copied!',
    'shareModal.copyError': 'Copy failed',
    'shareModal.joinTitle': 'Join {name}',

    // === Top scorer locked ===
    'tsLocked.title': 'Feature still locked',
    'tsLocked.subtitle': 'Waiting for the official squad lists',
    'tsLocked.why': 'Why is it locked?',
    'tsLocked.whyText': 'FIFA hasn\'t published the official squads yet. Each team must submit 26 players by June 1.',
    'tsLocked.how': 'How will it unlock?',
    'tsLocked.howText': 'The system checks automatically every day. As soon as the squads are released, the feature unlocks with all ~736 real players!',
    'tsLocked.what': 'What can I do meanwhile?',
    'tsLocked.whatText': 'Make your group and knockout predictions. Invite friends. You\'ll be notified when this unlocks.',
    'tsLocked.countdown': '⏱️ Until World Cup kickoff:',
    'tsLocked.openDate': 'June 11, 2026',
    'tsLocked.lastCheck': 'Last check: {time}',
    'tsLocked.loadingPlayers': 'Failed to load players',

    // === Top scorer unlocked ===
    'tsUnlocked.heroDesc': 'Who will score the most goals at the World Cup?<br><strong>+{n} bonus points</strong> if you predict correctly!',
    'tsUnlocked.hintTeam': '{code} (team)',
    'tsUnlocked.searchResults': 'Results for "{q}"',
    'tsUnlocked.currentLeaders': 'Current leaders',
    'tsUnlocked.forwardsWings': 'Forwards and wingers from top teams',
    'tsUnlocked.allPlayers': 'All World Cup players',
    'tsUnlocked.showing': 'Showing {n} of {total} results',
    'tsUnlocked.fallbackPlayer': 'Player',
    'tsUnlocked.starBadge': '⭐ Star',
    'tsUnlocked.confirmChange': 'Change your pick?\n\nFrom: {from}\nTo: {to}',
    'tsUnlocked.saveError': 'Failed to save pick: {msg}',
    'tsUnlocked.fallbackThePlayer': 'the player',
    'tsUnlocked.pickedToast': '🥇 You picked {name}!',
    'tsUnlocked.confirmClear': 'Clear top scorer pick?',
    'tsUnlocked.clearError': 'Failed to clear pick',
    'tsUnlocked.clearedToast': 'Pick cleared',

    // === Members list ===
    'membersList.title': 'Members',
    'membersList.total': 'Total',
    'membersList.bet': 'Bet',
    'membersList.notYet': 'Not yet',
    'membersList.partial': 'Made {n} picks',
    'membersList.complete': 'Completed groups',
    'membersList.notStarted': 'Not started yet',
    // v2.5.37: precise status per the new "groups + knockout" check
    'membersList.allDone': '✓ Locked in — all picks made',
    'membersList.inProgress': 'Started picking, not done yet',
    'membersList.needsKnockout': '⚠️ Missing knockout stage',
    'membersList.noBets': 'Hasn\'t bet yet',
    'membersList.fallbackUser': 'User',
    'membersList.joinedToday': 'Joined today',
    'membersList.joinedYesterday': 'Joined yesterday',
    'membersList.joinedDaysAgo': 'Joined {n} days ago',
    'membersList.joinedOn': 'Joined {date}',
    'membersList.loadError': 'Failed to load members',

    // === Recovery display ===
    'recoveryDisplay.title': 'Your recovery code',
    'recoveryDisplay.heroSubtitle': 'This code was shown only once when you joined. For security it cannot be shown again.',
    'recoveryDisplay.didntSave': 'Didn\'t save the code?',
    'recoveryDisplay.didntSaveText': 'Ask the pool admin to generate a new code for you. The old one stays valid — you can have 2 codes at once.',
    'recoveryDisplay.whyTitle': 'Why do I need a recovery code?',
    'recoveryDisplay.whyText': 'The recovery code is the only way to log in if you change devices, clear your browser, or want to access from elsewhere. Keep it safe!',
    'recoveryDisplay.backBtn': 'Got it, back to dashboard',
    'recoveryDisplay.copiedToast': '✓ Recovery code copied',
    'recoveryDisplay.notFound': 'No recovery code found',

    // === Help ===
    'helpEx.section1Title': '📋 How to bet',
    'helpEx.q1': '1. Joining a pool',
    'helpEx.a1': 'Tap "Join Pool" on the home page, enter the 5-letter code from your admin, choose a nickname and save the recovery code.',
    'helpEx.q2': '2. Group stage predictions',
    'helpEx.a2': 'In each of the 12 groups, pick 2 or 3 teams to advance. You must pick exactly 32 teams in total.',
    'helpEx.q3': '3. Scoring',
    'helpEx.a3': 'You earn a point (more with multipliers) for each correct prediction that advances.',
    'helpEx.section2Title': '🎲 Risk multipliers',
    'helpEx.q4': '⭐ Favorite — ×1',
    // v2.5.40: tier names alone (no ×N suffix) - JS appends the live value
    'helpEx.tierFav': 'Favorite',
    'helpEx.tierCont': 'Contender',
    'helpEx.tierUnd': 'Underdog',
    'helpEx.a4': 'Strong teams. Safe pick, one point only.',
    'helpEx.q5': '⚔️ Contender — ×1.5',
    'helpEx.a5': 'Mid-tier teams. Medium risk, medium reward.',
    'helpEx.q6': '🐶 Underdog — ×2',
    'helpEx.a6': 'Weak teams. High risk, double points if you\'re right!',
    'helpEx.section3Title': '🔐 Security & Privacy',
    'helpEx.q7': 'I lost my recovery code',
    'helpEx.a7': 'Contact the pool admin — only they can generate a new code for you. We don\'t store your code on the server for security.',
    'helpEx.q8': 'What personal data is saved?',
    'helpEx.a8': 'Only the nickname you chose and your picks. No email, phone, or other personal info required.',
    'helpEx.q9': 'What happens after the tournament?',
    'helpEx.a9': '30 days after the World Cup ends, all data is automatically deleted from the system.',
    'helpEx.section4Title': '💰 Money & Payments',
    'helpEx.q10': 'How do payments work?',
    'helpEx.a10': 'FriendlyBet doesn\'t handle money at all! Any financial side happens outside the app — in your group\'s WhatsApp or Telegram.',
    'helpEx.footer': 'More questions? Contact your pool admin.',

    // === Status modal ===
    'statusModal.almostTitle': 'Almost done!',
    'statusModal.missingPicks': '{n} more pick{plural} to go',
    'statusModal.doneTitle': 'Excellent! 🎉',
    'statusModal.doneSubtitle': 'You picked all 32 advancing teams',
    'statusModal.picked': 'Picked',
    'statusModal.of': 'of',
    'statusModal.missing': 'Missing',
    'statusModal.canAddTitle': 'Groups where you can add a 3rd pick:',
    'statusModal.noGroupsToAdd': 'No groups with 2 picks found.<br/>You can add in any group.',
    'statusModal.expandable': '{n} groups with 2 picks — tap to add a third:',
    'statusModal.closeBtn': 'Close and continue',

    // === Generic / app.js toasts ===
    'errors.loadError': 'Failed to load',
    'errors.unexpected': 'Unexpected error',
    'errors.unexpectedMsg': 'Unexpected error: {msg}',
    'errors.missingData': 'Error — missing data',
    'errors.reconnect': 'Error — please log in again',
    'errors.tryAgain': 'Error — please try again',
    'errors.serverConnecting': 'Connecting to server... try again in a moment',
    'errors.serverConnectingShort': 'Connecting to server...',
    'errors.serverConnectingRetry': 'Connecting to server... try again',
    'errors.searchingPool': 'Searching for pool...',
    'errors.poolSearchError': 'Pool search failed. Try again.',
    'errors.poolNotFoundCode': 'No pool found with code {code}',
    'errors.poolLockedNoJoin': '🔒 This pool is locked and not accepting new members',
    'errors.poolClosedKickoff': '🔒 Registration for this pool closed when the World Cup started. You can create a new late-entry pool until {time}.',
    'errors.poolClosedLate': '🔒 Registration and predictions closed when the first team started its second match ({time}).',
    'errors.lateEntryClosed': '🔒 New pools cannot be created after any team starts its second match ({time}).',
    'errors.joinCodeRequired': 'Please enter a pool code',
    'errors.joinCodeLen': 'Pool code is 5 characters',
    'errors.creatingUser': 'Creating user...',
    'errors.creatingUserFail': 'Failed to create user: {msg}',
    'errors.creatingPool': 'Creating pool...',
    'errors.uniqueCodeFail': 'Failed to generate unique code',
    'errors.creatingPoolFail': 'Failed to create pool: {msg}',
    'errors.creatingAdminFail': 'Failed to create admin: {msg}',
    'errors.poolCreated': 'Pool created successfully! 🎉',
    'errors.alreadyMember': 'You\'re already in a pool.\n\nTo join a new pool, you must leave the current one.\n\nLeave and join the new pool?',

    // === v2.0.0 - Wizard ===
    'wizard.title': 'Pool Setup',
    'wizard.stepLabel': 'Step {n} of {total}',
    'wizard.continueToSetup': 'Continue to setup',
    'wizard.next': 'Next',
    'wizard.back': 'Back',
    'wizard.createPool': 'Create Pool',
    'wizard.recommended': 'Recommended ⭐',
    'wizard.advanced': 'Advanced',
    'wizard.step1.title': 'Choose Betting Mode',
    'wizard.step1.subtitle': 'How will your players place their bets?',
    'wizard.step1.singlePhase.title': 'Single Phase Betting',
    'wizard.step1.singlePhase.description': 'Players bet ONCE before the tournament starts. They predict everything: group positions, full bracket, tournament winner, and top scorer.',
    'wizard.step1.twoPhase.title': 'Two-Phase Betting',
    'wizard.step1.twoPhase.description': 'Players bet TWICE: once before the groups (only group qualifiers), then again after the groups for knockout + top scorer. More realistic, but requires betting at two separate times.',
    'wizard.step2.title': 'Scoring Rules',
    'wizard.step2.subtitle': 'How are points calculated?',
    'wizard.step2.useDefaults': 'Use Recommended Rules',
    'wizard.step2.useDefaults.desc': 'Balanced settings that work for most groups.',
    'wizard.step2.customize': 'Customize Rules',
    'wizard.step2.customize.desc': 'Set the points for each stage yourself.',
    'wizard.step3.title': 'Review & Create',
    'wizard.step3.subtitle': 'Check the settings before creating the pool',
    'wizard.summary.poolName': 'Pool name',
    'wizard.summary.admin': 'Admin',
    'wizard.summary.mode': 'Betting mode',
    'wizard.summary.totalPoints': 'Max total points',
    'wizard.summary.rules': 'Scoring rules',
    'wizard.rule.group_first': 'Group 1st place',
    'wizard.rule.group_second': 'Group 2nd place',
    'wizard.rule.group_third': 'Group 3rd place',
    'wizard.rule.group_fourth': 'Group 4th place',
    'wizard.rule.third_place_advance': '3rd place that advances',
    'wizard.rule.round_of_32': 'Round of 32',
    'wizard.rule.round_of_16': 'Round of 16',
    'wizard.rule.quarter_final': 'Quarter Final',
    'wizard.rule.semi_final': 'Semi Final',
    'wizard.rule.final': 'Final',
    // v2.5.7: scoring rule group titles
    'wizard.ruleGroup.group': 'Group stage',
    'wizard.ruleGroup.knockout': 'Knockout',
    'wizard.ruleGroup.bonus': 'Bonus',
    'wizard.ruleGroup.winner': 'Tournament winner',
    // v2.5.27: two-phase combined "advancing team" label + multipliers explanation
    'wizard.rule.advancing_team': 'Each advancing team',
    'wizard.multipliers.explainTitle': 'How it works',
    'wizard.multipliers.explain': 'Every team is rated in one of three tiers based on FIFA ranking. Correctly betting on a weaker team scores you more: Favorite ×1, Contender ×1.5, Underdog ×2. The multiplier applies only to points earned from that specific team.',
    // v2.5.47: single_phase-only note + power-toggle label
    'wizard.multipliers.singlePhaseNote': 'In single-phase pools, multipliers apply only from the knockout stage onward. Group-position picks are scored by the position you predicted (4/3/2/1 by default) and are not multiplied.',
    'wizard.multipliers.powerOn': 'Multipliers on',
    'wizard.multipliers.powerOff': 'Multipliers off',
    // v2.5.56: "Optional" tag next to the multipliers title in the wizard
    'wizard.multipliers.optional': 'Optional',
    'wizard.multipliers.perTeamTitle': 'Per-team multiplier (optional)',
    'wizard.multipliers.perTeamHelp': 'Override the multiplier for a specific team. Untouched teams stay on the category multiplier.',
    'wizard.multipliers.perTeamReset': 'Reset all teams',
    'wizard.rule.tournament_winner': 'Tournament Winner',
    'wizard.rule.top_scorer': 'Top Scorer',

    // === v2.0.0 - Single-phase betting ===
    'betting.singlePhase.title': 'Single Phase Betting',
    'betting.groupPositions.title': 'Group Positions',
    'betting.groupPositions.instructions': 'Teams are pre-sorted by FIFA ranking. Drag to reorder them.',
    // v2.5.63: explains that the points are awarded for correctly
    // predicting each POSITION at the end of the group stage, not just
    // for picking advancing teams.
    'betting.groupStep': 'Group {n} of {total}',
    'betting.position.1': 'First place',
    'betting.position.2': 'Second place',
    'betting.position.3': 'Third place',
    'betting.position.4': 'Fourth place',
    'betting.groupFull': 'Group is full. Remove a team to replace.',
    'betting.groupsIncomplete': 'Missing predictions for groups: {letters}',
    // v2.5.62: softer "info" variant - the flow no longer blocks here
    'betting.groupsIncompleteHint': 'Moved on with incomplete groups: {letters}. You can always come back.',
    'betting.finalMissingHint': 'Moved on without picking the final winner. You can always come back.',
    // v2.5.64: partial-save toast from the summary screen
    'betting.partialSaveHint': '✓ Picks saved. Still left: {details}',
    'betting.continueToBracket': 'Continue to bracket',
    // v2.5.66: tertiary "skip" option on the sp-groups-screen
    'betting.skipForNow': 'Skip for now — I\'ll come back',
    'betting.bracket.title': 'Your Bracket',
    'betting.bracket.instructions': 'Your bracket is built from your group predictions. For each match - pick the winner.',
    // v2.5.72: shown on the FINAL match - the winner is the champion, worth
    // the final points (no separate bonus). Read live from scoring_rules.
    'betting.bracket.finalPoints': '🏆 The final winner is the champion — correct pick = {n} pts',
    'betting.tournamentWinner.title': 'Tournament Winner',
    'betting.tournamentWinner.question': 'Who wins the World Cup?',
    'betting.tournamentWinner.subtitle': 'Pick the team you think will lift the trophy',
    'betting.winnerRequired': 'Please pick a tournament winner',
    'betting.cascadeWarn': 'Changing this pick will clear {n} later-round pick(s) that depend on it (the team you picked before no longer advances). Continue?',
    'betting.finalRequired': 'Pick the final match winner before you continue',
    'betting.summary.title': 'Predictions Summary',
    'betting.summary.warning': 'You can edit your predictions any time before the tournament starts. Once the first match begins, they lock automatically.',
    'betting.summary.groups': 'Group Predictions',
    'betting.summary.bracket': 'Bracket',
    'betting.summary.winner': 'Tournament Winner',
    'betting.summary.topScorer': 'Top Scorer',
    'betting.summary.submit': 'Save my predictions',
    'betting.summary.saveChanges': 'Save changes',
    'betting.saved': 'Predictions saved! 🎯',
    'betting.continueToSummary': 'Continue to summary',
    'betting.summary.editTopScorer': 'Edit top scorer',
    'betting.summary.editPicks': 'Edit groups & bracket',
    'betting.notPicked': 'Not picked',
    'betting.confirmSubmit': '⚠️ Submit your final predictions?\n\nOnce submitted and the tournament starts, you cannot change them!',
    'betting.submitted': 'Predictions submitted! 🎉',
    'betting.locked.title': 'Your Predictions',
    'betting.locked.heading': 'Predictions submitted and locked',
    'betting.locked.message': 'No more changes allowed. View your predictions below.',

    // === v2.0.0 - Leaderboard breakdown ===
    'leaderboard.viewBracket': 'View knockout picks',
    'leaderboard.bracketOfTitle': 'Knockout picks · {name}',
    'leaderboard.breakdown.group': 'Groups',
    'leaderboard.breakdown.knockout': 'Knockout',
    'leaderboard.breakdown.bonus': 'Bonus',
    'leaderboard.noPicks': 'No predictions to show',

    // === v2.1.4 - Dashboard reflow ===
    'dashboard.preTournament.title': 'Tournament hasn\'t started yet',
    'dashboard.preTournament.subtitle': 'Your rank will appear here once matches begin',
    // v2.5.36: state-aware progress card text
    'dashboard.progress.notStarted.title': 'Ready to play? 🎯',
    'dashboard.progress.notStarted.subtitle': 'Pick your teams and lock it in — takes just a few minutes',
    // v2.5.38: admin-specific first-time CTA. Admins should invite friends
    // first so there\'s a pool to bet against, then make their own picks.
    'dashboard.progress.adminInviteFirst.title': 'Ready to play? 🎯',
    'dashboard.progress.adminInviteFirst.subtitle': 'First invite your friends, then make your own picks — takes just a few minutes',
    'dashboard.progress.partial.title': 'You\'re cooking 💪',
    'dashboard.progress.partial.subtitle': 'A few more picks and you\'re done',
    // v2.5.38: picks aren\'t actually locked at submit time - they\'re
    // editable until the tournament kicks off. Text reflects that.
    'dashboard.progress.allSet.title': 'ALL SET! 🎉',
    'dashboard.progress.allSet.subtitle': 'Your picks are in. Still tweakable right up to the opening whistle',
    'dashboard.startCta.title': 'Start predicting the World Cup',
    'dashboard.startCta.subtitle': 'Pick your teams for each group',
    'dashboard.continueCta.title': 'Continue your predictions',
    'dashboard.continueCta.partialGroups': '{n} of {total} groups done',
    'dashboard.continueCta.bracket': 'Finish your bracket up to the champion',
    'dashboard.continueCta.topScorer': 'Just pick your top scorer',
    'dashboard.continueCta.almostDone': 'One more step - bracket and top scorer',
    'dashboard.editCta.title': 'Edit your predictions',
    'dashboard.viewCta.title': 'View your predictions',
    'dashboard.viewCta.subtitle': 'Update or edit until the tournament starts',

    // === v2.1.0 - Recovery code screen ===
    'recovery.poolCreated.title': 'Pool Created!',
    'recovery.poolCreated.subtitle': 'Welcome to your pool!',
    'recovery.joined.title': 'You\'re In!',
    'recovery.joined.subtitle': 'Get ready to predict!',
    'recovery.codeLabel': 'Your Personal Recovery Code',
    'recovery.warning.title': 'Most important: save it as an image',
    'recovery.warning.text': 'It\'s the only way back into your account if you get logged out. Keep it private, don\'t share.',
    'recovery.privacy': 'It\'s like a password. Keep it private, don\'t share.',
    'recovery.qr.scanHint': 'If you ever get logged out, scan this QR or enter the code to get back into your pool.',
    'recovery.qr.scanToLogin': 'Scan to log in',
    // v2.5.37: shown only to members (not admin) on the recovery code screen
    'recovery.adminHelp.title': 'Lost the code? No worries.',
    'recovery.adminHelp.text': 'You can always ask the pool admin to send you a fresh recovery link on WhatsApp or Telegram.',
    'recovery.button.copy': 'Copy',
    'recovery.button.email': 'Email',
    'recovery.button.download': 'Download TXT',
    'recovery.button.copied': '✓ Copied!',
    'recovery.toast.copied': '✓ Copied to clipboard!',
    'recovery.toast.downloaded': '✓ File downloaded!',
    'recovery.button.continue': 'Continue to Pool',
    'recovery.button.close': 'Close',
    'recovery.warningModal.title': 'Did you save the code?',
    'recovery.warningModal.text': 'You\'ll need this code to log in from another device, or from this device if you sign out. Without it, there\'s no way back into your account.',
    'recovery.warningModal.saveCode': 'Save Code',
    'recovery.warningModal.continueAnyway': 'Continue Anyway',
    'recovery.warningModal.notYet': 'Not yet, go back to save',
    'recovery.warningModal.yesSaved': 'Yes, continue to pool',
    'recovery.menu.viewCode': 'My Recovery Code',
    'recovery.viewMode.title': 'Your Recovery Code',
    'recovery.email.subject': 'FriendlyBet Recovery Code',
    'recovery.email.body': 'Hi! 👋\n\nThis is your personal FriendlyBet recovery code.\nKeep it safe - you\'ll need it to access your account.\n\nRecovery Code: {code}\n\nPool: {poolName}\nLogin at: https://friendlybet.live\n\n⚠️ Keep this private! Don\'t share with anyone.',
    'recovery.txt.header': 'FriendlyBet Recovery Code',
    'recovery.txt.codeLabel': 'Your personal recovery code:',
    'recovery.txt.poolLabel': 'Pool:',
    'recovery.txt.createdLabel': 'Created:',
    'recovery.txt.important': 'IMPORTANT:',
    'recovery.txt.warning1': 'Keep this code private',
    'recovery.txt.warning2': 'Don\'t share with anyone',
    'recovery.txt.warning3': 'You\'ll need it to access your account',
    'recovery.txt.loginAt': 'Login at:',

    // === v2.4 additions (English) ===
    'recovery.button.screenshot': 'Save as image',
    'recovery.button.email': 'Email yourself',
    'recovery.button.download': 'Download Text File',
    'recovery.button.emailMe': 'Send the code to my email',
    'recovery.toast.screenshotDone': '✓ Marked as captured',
    'recovery.toast.emailCopied': '✓ Email content copied to clipboard - paste into your email',
    'recovery.toast.emailOpened': '✓ Opened your email client',
    'shareModal.copy': 'Copy',
    'recovery.toast.emailOpenedWithBackup': '✓ Opened email - content also copied to clipboard as backup',
    'recovery.toast.popupBlocked': 'Your browser blocked the new window. Please allow popups and try again.',

    'recovery.screenshot.title': 'Save your code as an image',
    'recovery.screenshot.intro': 'We generated an image with your recovery code. Save it to your gallery or share it to yourself.',
    'recovery.screenshot.codeLabel': 'Your recovery code',
    'recovery.screenshot.tip': 'After the screenshot, check the gallery to make sure the code is clear and readable.',
    'recovery.screenshot.done': 'Captured, continue',
    // v2.5.6: auto-screenshot strings
    'recovery.screenshot.generating': 'Generating image...',
    'recovery.screenshot.save': 'Save image to device',
    'recovery.screenshot.ios1': 'Press {k1} + {k2} at the same time',
    'recovery.screenshot.ios2': 'A thumbnail will briefly appear at the bottom of the screen',
    'recovery.screenshot.ios3': 'The screenshot is saved automatically to the Photos app',
    'recovery.screenshot.android1': 'Press and hold {k1} + {k2} together for ~1 second',
    'recovery.screenshot.samsung1': 'Press {k1} + {k2} together (or swipe with your palm across the screen)',
    'recovery.screenshot.android2': 'A preview of the screenshot will appear',
    'recovery.screenshot.android3': 'The screenshot is saved to your gallery automatically',
    'recovery.screenshot.mac1': 'Press {k1} + {k2} + {k3} then drag over the code',
    'recovery.screenshot.mac2': 'The screenshot is saved to your Desktop',
    'recovery.screenshot.win1': 'Press {k1} + {k2} + {k3} then drag over the code',
    'recovery.screenshot.win2': 'The screenshot is copied to clipboard / saved in Screenshots folder',
    'recovery.screenshot.generic1': 'Use your device\'s built-in screenshot function',
    'recovery.screenshot.generic2': 'The image will be saved to your gallery / desktop automatically',

    'exitApp.title': 'Exit the app?',
    'exitApp.text': 'You can come back any time - your predictions are saved automatically.',
    'exitApp.stay': 'Stay in app',
    'exitApp.confirm': 'Exit',

    'knockoutFirst.instructions': 'Pick the team you think will advance to the next round',
    'knockoutFirst.pointsLabel': '{n} points if you\'re right',
    // v2.5.60: shown when the two teams have different risk multipliers,
    // so a correct pick earns different totals depending on the team.
    'knockoutFirst.pointsLabelRange': '{min} or {max} points if you\'re right (depending on the team\'s risk multiplier)',
    // v2.5.65: extra line on the FINAL match - tournament winner bonus
    'knockoutFirst.finalIsChampion': '🏆 The final winner is the tournament champion',
    'knockoutFirst.skip': 'Skip for now',
    'knockoutFirst.completedToast': 'Great! You can now edit any pick',

    'groups.lockedTournamentStarted': 'Tournament started - predictions can no longer be edited',
  }
};

// ===== Language Detection =====

// v2.4: synchronous Israel detection - timezone OR browser language.
// Used at first paint; we layer an async IP check on top (geoDetectIsraelAsync)
// to catch travellers / mis-set locale where neither signal matches.
function isUserInIsrael() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Jerusalem' || tz === 'Asia/Tel_Aviv') return true;
  } catch (e) { /* ignore */ }

  const navLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (navLang === 'he' || navLang.startsWith('he-') || navLang === 'iw' || navLang.startsWith('iw-')) {
    return true;
  }
  // Browsers can also report region tags like "en-IL" / "ar-IL"
  if (navLang.endsWith('-il')) return true;

  // Manual override: a previously stored detection from the IP fallback
  try {
    if (localStorage.getItem('friendlybet_country') === 'IL') return true;
  } catch (e) { /* ignore */ }

  return false;
}

// v2.4: IP-based fallback. Runs asynchronously after page load. If the user
// turns out to be in Israel, set the body class and the localStorage hint so
// the next render uses it synchronously. We deliberately don't *un-set*
// Israel status from the IP lookup - the sync signals already cover that.
async function geoDetectIsraelAsync() {
  // Detect & cache the visitor's country (2-letter ISO) for: (a) auto-Hebrew toggle for IL,
  // (b) signup-time country capture in app.js. Stores the code for ANY country, not only IL.
  // Skip if we already have it cached AND it's IL (the only case that needs no network).
  if (localStorage.getItem('friendlybet_country') === 'IL' && isUserInIsrael()) return;
  if (localStorage.getItem('friendlybet_language') && localStorage.getItem('friendlybet_country')) return;

  // Primary: ipapi.co (gives lots of fields, but blocked by some adblockers / has free-tier limits).
  // Fallback: our own /api/geo route, which reads the Vercel edge x-vercel-ip-country header.
  // Same-origin, no rate limit, no third-party - so coverage approaches 100% for Vercel visitors.
  async function _try(url, timeoutMs) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) return null;
      const data = await res.json();
      const c = data && typeof data.country === 'string' ? data.country.toUpperCase() : '';
      return /^[A-Z]{2}$/.test(c) ? c : null;
    } catch (e) { return null; }
    finally { clearTimeout(timer); }
  }
  let country = await _try('https://ipapi.co/json/', 2500);
  if (!country) country = await _try('/api/geo', 1500);
  if (country) {
    try { localStorage.setItem('friendlybet_country', country); } catch (e) {}
    if (country === 'IL') document.body.classList.add('is-israel');
  }
}

function detectUserLanguage() {
  // 1. Check saved preference
  const saved = localStorage.getItem('friendlybet_language');
  if (saved === 'he' || saved === 'en') return saved;

  // 2. Detect by timezone OR browser language (Israel users)
  if (isUserInIsrael()) return 'he';

  // 3. Default to English
  return 'en';
}

// ===== State =====

let currentLanguage = detectUserLanguage();

// ===== Translation Function =====

function t(key, replacements = {}) {
  const lang = currentLanguage;
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  let value = dict[key];
  
  // Fallback chain: requested lang → English → key itself
  if (value === undefined) {
    value = TRANSLATIONS.en[key];
    if (value === undefined) {
      console.warn(`[i18n] Missing translation: ${key}`);
      return key;
    }
  }
  
  // Handle arrays (months, weekdays) - return as-is
  if (Array.isArray(value)) return value;
  
  // Replace {placeholders}
  Object.keys(replacements).forEach(k => {
    value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), replacements[k]);
  });
  
  return value;
}

// ===== Country Name Helper =====

function getCountryName(code) {
  return t(`country.${code}`) || code;
}

// ===== Language Switching =====

function setLanguage(lang) {
  if (lang !== 'he' && lang !== 'en') return;
  currentLanguage = lang;
  localStorage.setItem('friendlybet_language', lang);
  applyLanguage();
  
  // Update menu language switcher button states
  const heBtn = document.getElementById('lang-btn-he');
  const enBtn = document.getElementById('lang-btn-en');
  if (heBtn && enBtn) {
    heBtn.classList.toggle('active', lang === 'he');
    enBtn.classList.toggle('active', lang === 'en');
  }
  
  // Update home screen language switcher button states
  const homeHeBtn = document.getElementById('home-lang-btn-he');
  const homeEnBtn = document.getElementById('home-lang-btn-en');
  if (homeHeBtn && homeEnBtn) {
    homeHeBtn.classList.toggle('active', lang === 'he');
    homeEnBtn.classList.toggle('active', lang === 'en');
  }
  
  // Close menu if open (function from app.js)
  if (typeof closeMenu === 'function') {
    try { closeMenu(); } catch (e) {}
  }
  
  // Toast
  if (typeof showToast === 'function') {
    const msg = lang === 'he' ? '✓ עברית' : '✓ English';
    showToast(msg, 'success');
  }
}

function toggleLanguage() {
  setLanguage(currentLanguage === 'he' ? 'en' : 'he');
}

function getCurrentLanguage() {
  return currentLanguage;
}

function isRTL() {
  return currentLanguage === 'he';
}

// ===== Apply Language to Page =====

function applyLanguage() {
  const html = document.documentElement;
  const body = document.body;

  if (isRTL()) {
    html.setAttribute('dir', 'rtl');
    html.setAttribute('lang', 'he');
    body.classList.remove('ltr');
    body.classList.add('rtl');
  } else {
    html.setAttribute('dir', 'ltr');
    html.setAttribute('lang', 'en');
    body.classList.remove('rtl');
    body.classList.add('ltr');
  }

  // Mark Israeli users (timezone-based) so we can show the home-screen
  // language toggle only to them. Everyone else uses the menu switcher.
  body.classList.toggle('is-israel', isUserInIsrael());
  
  // Update language switcher button states (menu)
  const heBtn = document.getElementById('lang-btn-he');
  const enBtn = document.getElementById('lang-btn-en');
  if (heBtn && enBtn) {
    heBtn.classList.toggle('active', currentLanguage === 'he');
    enBtn.classList.toggle('active', currentLanguage === 'en');
  }
  
  // Update home screen language switcher button states
  const homeHeBtn = document.getElementById('home-lang-btn-he');
  const homeEnBtn = document.getElementById('home-lang-btn-en');
  if (homeHeBtn && homeEnBtn) {
    homeHeBtn.classList.toggle('active', currentLanguage === 'he');
    homeEnBtn.classList.toggle('active', currentLanguage === 'en');
  }
  
  // Update all elements with data-i18n attribute
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (typeof translated === 'string') {
      el.textContent = translated;
    }
  });
  
  // Update all placeholders with data-i18n-placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translated = t(key);
    if (typeof translated === 'string') {
      el.setAttribute('placeholder', translated);
    }
  });
  
  // Update aria-labels with data-i18n-aria
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria');
    el.setAttribute('aria-label', t(key));
  });
  
  // Update HTML with data-i18n-html (for content with tags)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    el.innerHTML = t(key);
  });
  
  // Update page <title> and meta description so browser tab / share previews
  // match the active language (prevents Hebrew leaking to English users).
  try {
    const pageTitle = t('page.title');
    const desc = t('page.description');
    if (typeof pageTitle === 'string' && pageTitle) document.title = pageTitle;
    // v2.5.82: keep description + social-share + locale meta in sync with the
    // active language. English stays English for the world; Hebrew is applied
    // only for Israeli visitors (currentLanguage === 'he').
    const setMeta = (sel, val) => { const el = document.querySelector(sel); if (el && val) el.setAttribute('content', val); };
    setMeta('meta[name="description"]', desc);
    setMeta('meta[property="og:title"]', pageTitle);
    setMeta('meta[property="og:description"]', desc);
    setMeta('meta[name="twitter:title"]', pageTitle);
    setMeta('meta[name="twitter:description"]', desc);
    setMeta('meta[property="og:locale"]', currentLanguage === 'he' ? 'he_IL' : 'en_US');
    // Swap the share image to the Hebrew card for Israeli visitors (same geo
    // gating as title/description). English raster card stays the global default.
    const ogImg = currentLanguage === 'he'
      ? 'https://friendlybet.live/og-image-he.png'
      : 'https://friendlybet.live/og-image.png';
    setMeta('meta[property="og:image"]', ogImg);
    setMeta('meta[property="og:image:secure_url"]', ogImg);
    setMeta('meta[property="og:image:alt"]', currentLanguage === 'he'
      ? 'FriendlyBet — הימור חברים על מונדיאל 2026'
      : 'FriendlyBet — free World Cup 2026 prediction pool. Soccer ball in a gold ring on dark.');
    setMeta('meta[name="twitter:image"]', ogImg);
    setMeta('meta[name="twitter:image:alt"]', currentLanguage === 'he'
      ? 'FriendlyBet — הימור חברים על מונדיאל 2026'
      : 'FriendlyBet — free World Cup 2026 prediction pool');
  } catch (e) {}

  // Dispatch event for app.js to re-render dynamic content
  window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: currentLanguage } }));
}

// ===== Date Formatting =====

function formatDateLocalized(date, options = {}) {
  if (!(date instanceof Date)) date = new Date(date);
  if (isNaN(date.getTime())) return '';
  
  const lang = currentLanguage;
  
  if (options.relative) {
    const now = new Date();
    const diffDays = Math.floor((date - now) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('date.today');
    if (diffDays === 1) return t('date.tomorrow');
    if (diffDays === -1) return t('date.yesterday');
  }
  
  if (lang === 'he') {
    return date.toLocaleDateString('he-IL', options);
  } else {
    return date.toLocaleDateString('en-US', options);
  }
}

function formatTimeLocalized(date) {
  if (!(date instanceof Date)) date = new Date(date);
  if (isNaN(date.getTime())) return '';
  
  const lang = currentLanguage;
  return date.toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: lang === 'en'
  });
}

// ===== Initial application =====
// Apply language as soon as DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyLanguage);
} else {
  applyLanguage();
}

// v2.4: kick off IP-based geo fallback so travelling Israelis still get the
// Hebrew toggle even if their device locale + timezone don't say so. Result
// is cached in localStorage as friendlybet_country=IL for next visits.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { geoDetectIsraelAsync(); });
} else {
  geoDetectIsraelAsync();
}
