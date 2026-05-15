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
    'common.loading': 'טוען...',
    'common.save': 'שמור',
    'common.cancel': 'ביטול',
    'common.delete': 'מחק',
    'common.close': 'סגור',
    'common.back': 'חזור',
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
    'welcome.subtitle': 'משחקי הימור חברתיים על המונדיאל',
    'welcome.tagline': 'הימור בלי כסף.\nרק כיף, נקודות וזכייה בכבוד.',
    'welcome.create': 'צור הימור חדש',
    'welcome.join': 'הצטרף להימור',
    'welcome.recoveryLogin': 'יש לי קוד שחזור',
    'welcome.noSignup': 'ללא הרשמה · ללא פרטים אישיים',
    
    'create.title': 'צור הימור חדש',
    'create.poolName': 'שם ההימור',
    'create.poolNamePlaceholder': 'למשל: ההימור של החבר\'ה',
    'create.nickname': 'הכינוי שלך',
    'create.nicknamePlaceholder': 'איך תופיע בלוח הדירוג',
    'create.button': 'צור הימור',
    
    'join.title': 'הצטרף להימור',
    'join.whichPool': 'איזה הימור?',
    'join.enterCode': 'הזן את קוד ההימור שקיבלת',
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
    'dashboard.invite.title': 'הזמן חברים להימור',
    'dashboard.invite.subtitle': 'שלח קישור ב-WhatsApp · Telegram · קוד QR',
    'dashboard.quickAction.leaderboard': 'דירוג',
    'dashboard.quickAction.help': 'עזרה',
    
    'dashboard.menu.title': 'תפריט',
    'dashboard.menu.invite': 'הזמן חברים להימור',
    'dashboard.menu.myInfo': 'המידע שלי',
    'dashboard.menu.showRecovery': 'הצג קוד שחזור',
    'dashboard.menu.members': 'רשימת משתתפים',
    'dashboard.menu.leaderboard': 'לוח דירוגים',
    'dashboard.menu.matches': 'לוח משחקים',
    'dashboard.menu.bracket': 'הבראקט',
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
    'groups.nextGroup': 'בית',
    'groups.completed': 'השלמת את כל הבתים!',
    'groups.savingPicks': 'שומר...',
    'groups.savedPicks': 'נשמר ✓',
    'groups.picksSaved': 'הבחירות נשמרו',
    
    // === Knockout ===
    'knockout.title': 'הימור על נוקאאוט',
    'knockout.r32': 'שמינית גמר',
    'knockout.r16': 'שמינית גמר',
    'knockout.qf': 'רבע גמר',
    'knockout.sf': 'חצי גמר',
    'knockout.final': 'גמר',
    'knockout.pickWinner': 'בחר את המנצח',
    'knockout.tbd': 'להיקבע',
    
    // === Top Scorer ===
    'topScorer.title': 'מלך השערים',
    'topScorer.heroTitle': 'נחש את מלך השערים',
    'topScorer.heroDesc': 'מי יבקיע הכי הרבה שערים במונדיאל?',
    'topScorer.heroBonus': '+25 נקודות בונוס',
    'topScorer.heroBonusEnd': 'אם תנחש נכון!',
    'topScorer.searchPlaceholder': 'חפש שחקן בעברית או באנגלית...',
    'topScorer.hintsTitle': '💡 דוגמאות לחיפוש:',
    'topScorer.hintsNote': 'ניתן לחפש לפי שם השחקן, חלק מהשם, או קוד הקבוצה (3 אותיות באנגלית)',
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
    'bracket.title': 'הבראקט',
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
    'country.UKR': 'אוקראינה',
    'country.TUR': 'טורקיה',
    'country.NOR': 'נורווגיה',
    'country.IRN': 'איראן',
    'country.TUN': 'תוניסיה',
    'country.EGY': 'מצרים',
    'country.CMR': 'קמרון',
    'country.GHA': 'גאנה',
    'country.PAN': 'פנמה',
    'country.JAM': 'ג\'מייקה',
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
  },
  
  en: {
    // === General / Common ===
    'app.name': 'FriendlyBet',
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.back': 'Back',
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
    'welcome.subtitle': 'Social World Cup prediction game',
    'welcome.tagline': 'No money involved.\nJust fun, points, and bragging rights.',
    'welcome.create': 'Create New Pool',
    'welcome.join': 'Join Pool',
    'welcome.recoveryLogin': 'I have a recovery code',
    'welcome.noSignup': 'No signup · No personal details',
    
    'create.title': 'Create New Pool',
    'create.poolName': 'Pool Name',
    'create.poolNamePlaceholder': 'e.g. The Boys Pool',
    'create.nickname': 'Your Nickname',
    'create.nicknamePlaceholder': 'How you appear on the leaderboard',
    'create.button': 'Create Pool',
    
    'join.title': 'Join Pool',
    'join.whichPool': 'Which Pool?',
    'join.enterCode': 'Enter the pool code you received',
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
    'dashboard.invite.title': 'Invite friends to pool',
    'dashboard.invite.subtitle': 'Send link via WhatsApp · Telegram · QR code',
    'dashboard.quickAction.leaderboard': 'Leaderboard',
    'dashboard.quickAction.help': 'Help',
    
    'dashboard.menu.title': 'Menu',
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
    
    // === Knockout ===
    'knockout.title': 'Knockout Predictions',
    'knockout.r32': 'Round of 32',
    'knockout.r16': 'Round of 16',
    'knockout.qf': 'Quarter-Finals',
    'knockout.sf': 'Semi-Finals',
    'knockout.final': 'Final',
    'knockout.pickWinner': 'Pick the winner',
    'knockout.tbd': 'TBD',
    
    // === Top Scorer ===
    'topScorer.title': 'Top Scorer',
    'topScorer.heroTitle': 'Predict the Top Scorer',
    'topScorer.heroDesc': 'Who will score the most goals at the World Cup?',
    'topScorer.heroBonus': '+25 bonus points',
    'topScorer.heroBonusEnd': 'if you predict correctly!',
    'topScorer.searchPlaceholder': 'Search player in English or Hebrew...',
    'topScorer.hintsTitle': '💡 Search examples:',
    'topScorer.hintsNote': 'Search by player name, partial name, or team code (3 letters)',
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
    'country.UKR': 'Ukraine',
    'country.TUR': 'Turkey',
    'country.NOR': 'Norway',
    'country.IRN': 'Iran',
    'country.TUN': 'Tunisia',
    'country.EGY': 'Egypt',
    'country.CMR': 'Cameroon',
    'country.GHA': 'Ghana',
    'country.PAN': 'Panama',
    'country.JAM': 'Jamaica',
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
  }
};

// ===== Language Detection =====

function detectUserLanguage() {
  // 1. Check saved preference
  const saved = localStorage.getItem('friendlybet_language');
  if (saved === 'he' || saved === 'en') return saved;
  
  // 2. Detect by timezone (most accurate)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz === 'Asia/Jerusalem' || tz === 'Asia/Tel_Aviv') {
      return 'he';
    }
  } catch (e) {}
  
  // 3. Fallback to browser language
  const navLang = navigator.language || navigator.userLanguage || '';
  if (navLang.startsWith('he')) return 'he';
  
  // 4. Default to English
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
