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
    'welcome.subtitle': 'להמר עם חברים על תוצאות המונדיאל.',
    'welcome.tagline': '100% חינמי · ללא פרסומות · ללא הגבלות · ללא תשלום',
    'welcome.create': 'צור הימור חדש',
    'welcome.join': 'הצטרף להימור',
    'welcome.recoveryLogin': 'יש לי קוד שחזור',
    'welcome.noSignup': 'אפליקציה זו היא תוכנה חופשית בקוד פתוח. היא לא אוספת מידע אישי. <a href="https://github.com/Aviatorpo/friendlybet" target="_blank" rel="noopener">לצפייה בקוד ב-GitHub</a>.',
    
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
    'createPool.suggestion1': 'מאמני הסלון',
    'createPool.suggestion2': 'אלופי השכונה',
    'createPool.suggestion3': 'האנדרדוגים',
    'createPool.suggestion4': 'מומחי המונדיאל',
    'createPool.errorRequired': 'נא להזין שם להימור',
    'createPool.errorMin': 'השם חייב להיות לפחות {n} תווים',

    // === Admin nickname ===
    'adminNickname.step': 'שלב 2 מתוך 3',
    'adminNickname.subtitle': 'הכינוי שלך כמארגן וגם כמשתתף',
    'adminNickname.placeholder': 'לדוגמה: אסף',
    'adminNickname.permTitle': 'הרשאות המארגן',
    'adminNickname.perm1': 'ניהול חברי ההימור',
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
    'sharePool.promptTitle': 'ההימור נוצר עם חוקי Golazo (ברירת מחדל)',
    'sharePool.promptSubtitle': 'תוכל לערוך את כל החוקים לפני שמישהו מצטרף',
    'sharePool.editSettings': 'ערוך הגדרות',
    'sharePool.divider': 'או פשוט שתף ותתחיל לשחק',
    'sharePool.whatsapp': 'שתף ב-WhatsApp',
    'sharePool.telegram': 'שתף ב-Telegram',
    'sharePool.copyLink': 'העתק קישור',
    'sharePool.toDashboard': 'לדשבורד שלי',
    'sharePool.welcomeToast': 'ברוך הבא ל-{name}!',
    'sharePool.adminCodeAlert': '🔑 קוד השחזור שלך כמארגן:\n\n{code}\n\nשמור אותו במקום בטוח! בלעדיו לא תוכל להתחבר חזרה.',
    'sharePool.shareText': '🏆 הצטרף להימור "{poolName}" במונדיאל 2026!\n\nקוד ההימור: {code}\n\n👇 לחץ על הקישור כדי להצטרף:\n{url}\n\n📱 FriendlyBet - הימור חברים, חינמי, בלי פרסומות, בלי כסף.',

    // === Pool settings ===
    'poolSettings.lockedTitle': 'החוקים נעולים',
    'poolSettings.lockedText': 'משתתפים כבר הצטרפו - לא ניתן לשנות חוקים',
    'poolSettings.poolInfo': 'פרטי ההימור',
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
    'poolSettings.resetGolazo': 'איפוס לחוקי Golazo',
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
    'poolSettings.resetToast': 'הוחזר לחוקי Golazo המקוריים',
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
    'groups.tierFavorite': '⭐ פייבוריטית ×1',
    'groups.tierContender': '⚔️ מתמודדת ×1.5',
    'groups.tierUnderdog': '🐴 אנדרדוג ×2',
    'groups.tooltipAdvanced': 'הקבוצה עלתה!',
    'groups.tooltipEliminated': 'הקבוצה הודחה',
    'groups.maxReachedToast': 'כבר בחרת 3 קבוצות. הסר אחת לפני שתוסיף עוד',
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
    'matchesEx.finished': 'הסתיים',
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
    'shareModal.subtitle': 'שלח להם את הקישור והם יצטרפו בלחיצה אחת',
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
    'tsUnlocked.heroDesc': 'מי יבקיע הכי הרבה שערים במונדיאל?<br><strong>+25 נקודות בונוס</strong> אם תנחש נכון!',
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
    'helpEx.a4': 'קבוצות חזקות. ניחוש "בטוח" אבל נקודה אחת בלבד.',
    'helpEx.q5': '⚔️ מתמודדת - ×1.5',
    'helpEx.a5': 'קבוצות באמצע הדירוג. סיכון בינוני, פרס בינוני.',
    'helpEx.q6': '🐴 אנדרדוג - ×2',
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
    'welcome.subtitle': 'Bet with friends on World Cup results.',
    'welcome.tagline': '100% FREE · NO ADS · NO LIMITS · NO PAYWALLS',
    'welcome.create': 'Create New Pool',
    'welcome.join': 'Join Pool',
    'welcome.recoveryLogin': 'I have a recovery code',
    'welcome.noSignup': 'This webapp is Free Open Source Software. It does not collect any personal data. <a href="https://github.com/Aviatorpo/friendlybet" target="_blank" rel="noopener">See the code on GitHub</a>.',
    
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
    'createPool.suggestion1': 'Couch Coaches',
    'createPool.suggestion2': 'Bracket Busters',
    'createPool.suggestion3': 'The Underdogs',
    'createPool.suggestion4': 'Pitch Perfect',
    'createPool.errorRequired': 'Please enter a pool name',
    'createPool.errorMin': 'Name must be at least {n} characters',

    // === Admin nickname ===
    'adminNickname.step': 'Step 2 of 3',
    'adminNickname.subtitle': 'Your nickname — as admin AND member',
    'adminNickname.placeholder': 'e.g. Asaf',
    'adminNickname.permTitle': 'Admin permissions',
    'adminNickname.perm1': 'Manage pool members',
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
    'sharePool.shareText': '🏆 Join the "{poolName}" pool for World Cup 2026!\n\nPool code: {code}\n\n👇 Tap the link to join:\n{url}\n\n📱 FriendlyBet — free social predictions, no ads, no money.',

    // === Pool settings ===
    'poolSettings.lockedTitle': 'Rules locked',
    'poolSettings.lockedText': 'Members already joined — rules cannot be changed',
    'poolSettings.poolInfo': 'Pool info',
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
    'groups.tierFavorite': '⭐ Favorite ×1',
    'groups.tierContender': '⚔️ Contender ×1.5',
    'groups.tierUnderdog': '🐴 Underdog ×2',
    'groups.tooltipAdvanced': 'Team advanced!',
    'groups.tooltipEliminated': 'Team eliminated',
    'groups.maxReachedToast': 'Already picked 3 teams. Remove one before adding another',
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
    'complete.toDashboard': 'Back to dashboard',
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
    'matchesEx.finished': 'Final',
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
    'shareModal.subtitle': 'Send them the link and they join in one tap',
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
    'tsUnlocked.heroDesc': 'Who will score the most goals at the World Cup?<br><strong>+25 bonus points</strong> if you predict correctly!',
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
    'helpEx.a4': 'Strong teams. Safe pick, one point only.',
    'helpEx.q5': '⚔️ Contender — ×1.5',
    'helpEx.a5': 'Mid-tier teams. Medium risk, medium reward.',
    'helpEx.q6': '🐴 Underdog — ×2',
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
  }
};

// ===== Language Detection =====

function isUserInIsrael() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz === 'Asia/Jerusalem' || tz === 'Asia/Tel_Aviv';
  } catch (e) {
    return false;
  }
}

function detectUserLanguage() {
  // 1. Check saved preference
  const saved = localStorage.getItem('friendlybet_language');
  if (saved === 'he' || saved === 'en') return saved;

  // 2. Detect by timezone (most accurate)
  if (isUserInIsrael()) return 'he';

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
