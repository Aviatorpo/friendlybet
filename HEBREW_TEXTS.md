# FriendlyBet — טקסטים בעברית לעריכה

כל טקסט שהמשתמש רואה באפליקציה, מסודר לפי קטגוריות (מקור: `i18n.js`).

## איך לערוך
- שנה **רק** את הטקסט בעמודת "עברית".
- **אל תשנה** את עמודת "מפתח (key)" — לפיה אני מזהה איפה להחיל את השינוי.
- `{n}`, `{name}`, `{total}` וכו' = מציין-מקום שמתחלף בערך בזמן ריצה. שמור עליו בדיוק כמו שהוא.
- הסימן ` ⏎ ` מציין מעבר שורה בתוך הטקסט.
- כשתסיים — תחזיר לי את הקובץ (או רק את השורות ששינית) ואני אחיל הכול.

---

## תוכן עניינים

- General / Common
- Onboarding
- Dashboard
- Group Betting
- Knockout
- Top Scorer
- Risk Simulator
- Leaderboard
- Matches
- Bracket
- Members
- Admin
- Sharing / Invite
- Help
- Toasts / Messages
- Confirmations
- Dates / Time
- Country Names
- Extended common
- PWA install banner
- Pool found screen
- Nickname screen
- Recovery code creation
- Create pool
- Admin nickname
- Share pool
- Pool settings
- Group betting
- Betting complete
- Knockout extras
- Bracket view
- Simulator
- Matches extras
- Admin members
- Admin modal
- Share modal
- Top scorer locked
- Top scorer unlocked
- Members list
- Recovery display
- Help
- Status modal
- Generic / app.js toasts
- v2.0.0 - Wizard
- v2.0.0 - Single-phase betting
- v2.0.0 - Leaderboard breakdown
- v2.1.4 - Dashboard reflow
- v2.1.0 - Recovery code screen
- v2.4 additions (Hebrew)

---


## General / Common

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `app.name` | FriendlyBet | FriendlyBet |
| `common.loading` | טוען... | Loading... |
| `common.save` | שמור | Save |
| `common.cancel` | ביטול | Cancel |
| `common.delete` | מחק | Delete |
| `common.close` | סגור | Close |
| `common.back` | חזור | Back |
| `common.next` | הבא | Next |
| `common.confirm` | אשר | Confirm |
| `common.yes` | כן | Yes |
| `common.no` | לא | No |
| `common.error` | שגיאה | Error |
| `common.success` | הצלחה | Success |
| `common.copy` | העתק | Copy |
| `common.share` | שתף | Share |
| `common.copied` | הועתק! | Copied! |
| `common.continue` | המשך | Continue |
| `common.skip` | דלג | Skip |
| `common.create` | צור | Create |
| `common.add` | הוסף | Add |
| `common.remove` | הסר | Remove |
| `common.edit` | ערוך | Edit |
| `common.update` | עדכן | Update |
| `common.send` | שלח | Send |
| `common.points` | נק\' | pts |
| `common.bonusPoints` | נק\' בונוס | bonus pts |
| `common.you` | אתה | You |
| `common.admin` | מארגן | Admin |
| `common.adminBadge` | מארגן ✓ | Admin ✓ |
| `common.day` | יום | day |
| `common.days` | ימים | days |
| `common.daysUntil` | ימים עד | days until |
| `common.lastUpdated` | עודכן | Updated |
| `common.allRights` | כל הזכויות | All rights reserved |
| `common.menu` | תפריט | Menu |

## Onboarding

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `welcome.title` | FriendlyBet | FriendlyBet |
| `welcome.subtitle` | הימור חברים על מונדיאל 2026 | World Cup Predictions with Your Friends |
| `welcome.tagline` | 100% חינמי · ללא פרסומות · ללא הגבלות | 100% FREE · NO ADS · NO LIMITS · NO PAYWALLS |
| `welcome.create` | צור הימור חדש | Create New Pool |
| `welcome.join` | הצטרף להימור | Join Pool |
| `welcome.recoveryLogin` | יש לי קוד שחזור | I have a recovery code |
| `recoveryLogin.title` | התחבר עם קוד שחזור | Log in with recovery code |
| `recoveryLogin.heading` | הזן את הקוד | Enter your code |
| `recoveryLogin.subtitle` | הקוד בן 16 תווים שקיבלת בעת ההצטרפות או יצירת ההימור | The 16-character code you received when you joined or created the pool |
| `recoveryLogin.codeLabel` | קוד שחזור | Recovery code |
| `recoveryLogin.submit` | התחבר | Log in |
| `recoveryLogin.errorShort` | הקוד קצר מדי - בדוק שהזנת אותו במלואו | Code is too short — make sure you entered it fully |
| `recoveryLogin.errorNotFound` | קוד לא נמצא. בדוק שהזנת בדיוק את הקוד שקיבלת. | Code not found. Make sure it matches exactly what you received. |
| `recoveryLogin.errorNoPool` | ההימור שמשויך לקוד הזה לא נמצא | The pool linked to this code could not be found |
| `recoveryLogin.success` | ברוך שובך, {nickname}! | Welcome back, {nickname}! |
| `welcome.noSignup` | קוד פתוח · ללא איסוף מידע אישי · <a href="https://github.com/Aviatorpo/friendlybet" target="_blank" rel="noopener">GitHub</a> | Open source · No personal data collected · <a href="https://github.com/Aviatorpo/friendlybet" target="_blank" rel="noopener">GitHub</a> |
| `create.title` | צור הימור חדש | Create New Pool |
| `create.poolName` | שם ההימור | Pool Name |
| `create.poolNamePlaceholder` | למשל: ההימור של החבר\'ה | e.g. The Boys Pool |
| `create.nickname` | הכינוי שלך | Your Nickname |
| `create.nicknamePlaceholder` | איך תופיע בלוח הדירוג | How you appear on the leaderboard |
| `create.button` | צור הימור | Create Pool |
| `join.title` | הצטרף להימור | Join Pool |
| `join.whichPool` | איזה הימור? | Which Pool? |
| `join.enterCode` | הזן את קוד ההימור שקיבלת | Enter the pool code you received |
| `join.code` | קוד ההימור | Pool Code |
| `join.codePlaceholder` | 5 אותיות, למשל: ABCDE | 5 letters, e.g. ABCDE |
| `join.nickname` | הכינוי שלך | Your Nickname |
| `join.nicknamePlaceholder` | איך תופיע בלוח הדירוג | How you appear on the leaderboard |
| `join.button` | הצטרף | Join |
| `join.invitedTo` | הוזמנת ל | You\'re invited to |
| `join.poolCode` | קוד | Code |
| `join.findError` | הקוד לא נמצא. בדוק שוב. | Code not found. Try again. |
| `join.poolLocked` | ההימור נעול | Pool Locked |
| `join.poolLockedDesc` | המארגן נעל את ההימור. לא ניתן להצטרף. | The admin has locked this pool. Cannot join. |
| `recovery.title` | התחברות עם קוד שחזור | Login with Recovery Code |
| `recovery.code` | הקוד שלך | Your Code |
| `recovery.codePlaceholder` | 16 תווים | 16 characters |
| `recovery.button` | התחבר | Log In |
| `recoveryCode.title` | שמור את קוד השחזור! | Save your recovery code! |
| `recoveryCode.subtitle` | תזדקק לו כדי להיכנס שוב מטלפון אחר | You\'ll need it to log in from another device |
| `recoveryCode.warning` | הקוד הזה לא יוצג שוב. שמור אותו במקום בטוח. | This code won\'t be shown again. Save it somewhere safe. |
| `recoveryCode.continue` | הבנתי, המשך | Got it, continue |
| `recoveryCode.copyButton` | העתק קוד | Copy code |

## Dashboard

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `dashboard.greeting` | היי | Hi |
| `dashboard.your` | ההימור שלך | Your Pool |
| `dashboard.points` | נקודות | Points |
| `dashboard.rank` | מקום | Rank |
| `dashboard.position` | בלוח | on leaderboard |
| `dashboard.poolCode` | קוד הימור | Pool code |
| `dashboard.share` | שתף | Share |
| `dashboard.myRank` | המקום שלך | Your rank |
| `dashboard.myBets` | ההימורים שלי | My predictions |
| `dashboard.status.groups` | שלב הבתים | Group stage |
| `dashboard.status.knockout` | שלב הנוקאאוט | Knockout stage |
| `dashboard.status.topScorer` | מלך השערים | Top scorer |
| `dashboard.status.notStarted` | עדיין לא הימרת |  |
| `dashboard.status.partialGroups` | הימרת על {n} מתוך 32 | Picked {n} of 32 |
| `dashboard.status.completedGroups` | הושלם · 32 קבוצות | Done · 32 teams |
| `dashboard.status.afterGroups` | נפתח אחרי שלב הבתים | Opens after group stage |
| `dashboard.status.koReady` | מוכן להמר על 31 משחקים | Ready to predict 31 matches |
| `dashboard.status.partialKo` | הימרת על {n} מתוך 31 | Picked {n} of 31 |
| `dashboard.status.completedKo` | הושלם · 31 משחקים | Done · 31 matches |
| `dashboard.status.topScorerLocked` | נפתח בקרוב | Opens soon |
| `dashboard.action.start` | התחל | Start |
| `dashboard.action.continue` | המשך | Continue |
| `dashboard.action.edit` | ערוך | Edit |
| `dashboard.invite.title` | הזמן חברים להימור | Invite friends to pool |
| `dashboard.invite.subtitle` | שלח קישור ב-WhatsApp או Telegram | Send a link via WhatsApp or Telegram |
| `dashboard.quickAction.leaderboard` | דירוג | Leaderboard |
| `dashboard.quickAction.help` | עזרה | Help |
| `dashboard.menu.title` | תפריט | Menu |
| `dashboard.role.member` | משתתף | Member |
| `dashboard.role.adminMember` | מארגן ומשתתף | Admin & Member |
| `dashboard.fallback.nickname` | משתמש | User |
| `dashboard.fallback.poolName` | הימור | Pool |
| `dashboard.menu.invite` | הזמן חברים להימור | Invite friends to pool |
| `dashboard.menu.myInfo` | המידע שלי | My info |
| `dashboard.menu.showRecovery` | הצג קוד שחזור | Show recovery code |
| `dashboard.menu.members` | רשימת משתתפים | Members list |
| `dashboard.menu.leaderboard` | לוח דירוגים | Leaderboard |
| `dashboard.menu.matches` | לוח משחקים | Match schedule |
| `dashboard.menu.bracket` | שלב הנוקאאוט | Bracket |
| `dashboard.menu.topScorer` | מלך השערים | Top Scorer |
| `dashboard.menu.help` | עזרה ושאלות נפוצות | Help & FAQ |
| `dashboard.menu.admin` | אזור מארגן | Admin area |
| `dashboard.menu.manageMembers` | ניהול חברים | Manage members |
| `dashboard.menu.settings` | הגדרות ההימור | Pool settings |
| `dashboard.menu.preferences` | הגדרות | Preferences |
| `dashboard.menu.language` | שפה | Language |
| `dashboard.menu.leave` | התנתק מההימור | Leave pool |
| `dashboard.action.groups` | הימור על בתים | Group Stage Predictions |
| `dashboard.action.groups.desc` | בחר את הקבוצות שיעלו לנוקאאוט | Pick which teams will advance to knockout |
| `dashboard.action.knockout` | הימור על נוקאאוט | Knockout Predictions |
| `dashboard.action.knockout.desc` | נחש מי יעלה מ-32 הקבוצות | Predict winners of the 32 advancing teams |
| `dashboard.action.topScorer` | מלך השערים | Top Scorer |
| `dashboard.action.topScorer.desc` | נחש מי יבקיע הכי הרבה שערים | Pick who will score the most goals |
| `dashboard.action.simulator` | סימולטור סיכון | Risk Simulator |
| `dashboard.action.simulator.desc` | תכנן אסטרטגיה עם הימור על אנדרדוגים | Plan your strategy with underdog bets |
| `dashboard.poolLocked` | ההימור נעול - לא ניתן לשנות בחירות | Pool locked - predictions cannot be changed |
| `dashboard.poolLockedShort` | נעול | Locked |

## Group Betting

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `groups.title` | הימור על בתים | Group Stage Predictions |
| `groups.group` | בית | Group |
| `groups.pickInstructions` | בחר 2 או 3 קבוצות מהבית הזה | Pick 2 or 3 teams from this group |
| `groups.advance` | יעלו לנוקאאוט | will advance to knockout |
| `groups.tier.favorite` | פייבוריט | Favorite |
| `groups.tier.contender` | מתחרה | Contender |
| `groups.tier.underdog` | אנדרדוג | Underdog |
| `groups.tier.favorite.multi` | ×1 | ×1 |
| `groups.tier.contender.multi` | ×1.5 | ×1.5 |
| `groups.tier.underdog.multi` | ×2 | ×2 |
| `groups.minPicks` | בחר לפחות 2 | Pick at least 2 |
| `groups.maxReached` | כבר בחרת 3 קבוצות. הסר אחת לפני שתוסיף עוד | You already picked 3 teams. Remove one to add more |
| `groups.finishBetting` | סיים את ההימור | Finish predictions |
| `groups.nextGroup` | בית | Group {letter} |
| `groups.completed` | השלמת את כל הבתים! | You completed all groups! |
| `groups.savingPicks` | שומר... | Saving... |
| `groups.savedPicks` | נשמר ✓ | Saved ✓ |
| `groups.picksSaved` | הבחירות נשמרו | Predictions saved |

## Knockout

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `knockout.title` | הימור על נוקאאוט | Knockout Predictions |
| `knockout.r32` | סבב 32 | Round of 32 |
| `knockout.r16` | שמינית גמר | Round of 16 |
| `knockout.qf` | רבע גמר | Quarter-Finals |
| `knockout.sf` | חצי גמר | Semi-Finals |
| `knockout.final` | גמר | Final |
| `knockout.pickWinner` | בחר את המנצח | Pick the winner |
| `knockout.tbd` | להיקבע | TBD |

## Top Scorer

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `topScorer.title` | מלך השערים | Top Scorer |
| `topScorer.heroTitle` | נחש את מלך השערים | Predict the Top Scorer |
| `topScorer.heroDesc` | מי יבקיע הכי הרבה שערים במונדיאל? | Who will score the most goals at the World Cup? |
| `topScorer.heroBonus` | +25 נקודות בונוס | +25 bonus points |
| `topScorer.heroBonusEnd` | אם תנחש נכון! | if you predict correctly! |
| `topScorer.searchPlaceholder` | חיפוש שחקן (באנגלית בלבד)... | Search player (English only)... |
| `topScorer.hintsTitle` | 💡 דוגמאות לחיפוש: | 💡 Search examples: |
| `topScorer.hintsNote` | ניתן לחפש לפי שם השחקן, חלק מהשם, או קוד הקבוצה (3 אותיות באנגלית) | Search by player name, partial name, or team code (3 letters) |
| `topScorer.teamSuffix` | (קבוצה) | (team) |
| `page.title` | FriendlyBet · הימור חברים על מונדיאל 2026 | FriendlyBet · Friends World Cup 2026 predictions |
| `page.description` | הימור חברים על מונדיאל 2026 - חינמי, בלי פרסומות, בלי כסף | Friends World Cup 2026 predictions — free, no ads, no money |
| `topScorer.team` | קבוצה | Team |
| `topScorer.noResults` | לא נמצאו שחקנים | No players found |
| `topScorer.tryOther` | נסה לחפש שם אחר | Try a different name |
| `topScorer.yourPick` | הבחירה שלך: | Your pick: |
| `topScorer.changePick` | שנה בחירה | Change pick |
| `topScorer.clearPick` | נקה בחירה | Clear pick |
| `topScorer.confirmChange` | להחליף את הבחירה? | Change your pick? |
| `topScorer.picked` | בחרת ב- | You picked  |
| `topScorer.cleared` | הבחירה בוטלה | Pick cleared |
| `topScorer.star` | כוכב | Star |
| `topScorer.locked.title` | מלך השערים יפתח בקרוב | Top Scorer opens soon |
| `topScorer.locked.desc` | נחכה לפרסום הסגלים הרשמיים על-ידי FIFA | Waiting for official squad lists from FIFA |
| `topScorer.locked.daysUntil` | ימים עד תחילת המונדיאל | days until World Cup starts |
| `topScorer.locked.lastCheck` | בדיקה אחרונה | Last check |

## Risk Simulator

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `simulator.title` | סימולטור סיכון | Risk Simulator |
| `simulator.desc` | תכנן את האסטרטגיה שלך | Plan your strategy |
| `simulator.totalBets` | סה"כ בחירות | Total picks |
| `simulator.expectedPoints` | נקודות צפויות | Expected points |
| `simulator.byTier` | לפי דרגה: | By tier: |
| `simulator.recommendation` | המלצה | Recommendation |

## Leaderboard

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `leaderboard.title` | לוח דירוגים | Leaderboard |
| `leaderboard.rank` | מקום | Rank |
| `leaderboard.player` | שחקן | Player |
| `leaderboard.points` | נקודות | Points |
| `leaderboard.groups` | בתים | Groups |
| `leaderboard.knockout` | נוקאאוט | Knockout |
| `leaderboard.bonus` | בונוס | Bonus |
| `leaderboard.total` | סה"כ | Total |
| `leaderboard.notStarted` | עדיין לא הימר | Not started yet |
| `leaderboard.partial` | הימר על | Made |
| `leaderboard.partialPicks` | בחירות | picks |
| `leaderboard.complete` | השלים את הבתים | Completed groups |
| `leaderboard.you` | (אתה) | (you) |
| `leaderboard.empty` | אין משתתפים | No participants |
| `leaderboard.joinedToday` | הצטרף היום | Joined today |
| `leaderboard.joinedYesterday` | הצטרף אתמול | Joined yesterday |
| `leaderboard.joinedDaysAgo` | הצטרף לפני {n} ימים | Joined {n} days ago |
| `leaderboard.joinedOn` | הצטרף ב-{date} | Joined on {date} |
| `leaderboard.fullRanking` | דירוג מלא | Full ranking |
| `leaderboard.emptyTitle` | הטורניר עוד לא התחיל | Tournament hasn\'t started yet |
| `leaderboard.emptyText` | הניקוד יחושב אחרי שיתחילו המשחקים | Scores will be calculated after matches begin |
| `leaderboard.participantsCount` | {n} משתתפים | {n} participants |
| `leaderboard.statusBefore` | לפני התחלת הטורניר | Before tournament starts |
| `leaderboard.statusDuring` | במהלך הטורניר | Tournament in progress |
| `leaderboard.podiumEmpty` | ריק | Empty |
| `leaderboard.noPointsYet` | עדיין בלי נקודות | No points yet |
| `leaderboard.loadError` | שגיאה בטעינת הדירוג | Failed to load leaderboard |
| `leaderboard.shareText` | 🏆 לוח הדירוגים של {poolName}!\n\nהצטרף ל-FriendlyBet והתחרה איתנו על מונדיאל 2026:\n{url} | 🏆 Leaderboard for {poolName}!\n\nJoin FriendlyBet and compete with us on World Cup 2026:\n{url} |

## Matches

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `matches.title` | לוח משחקים | Match Schedule |
| `matches.filter.all` | הכל | All |
| `matches.filter.live` | חי | Live |
| `matches.filter.today` | היום | Today |
| `matches.filter.upcoming` | עתידי | Upcoming |
| `matches.empty` | אין משחקים להצגה | No matches to display |
| `matches.live` | חי | LIVE |
| `matches.finished` | הסתיים | Final |
| `matches.scheduled` | מתוכנן | Scheduled |
| `matches.matchNum` | משחק | Match |
| `matches.youPredicted` | ניחשת: | Your pick: |
| `matches.correctPrediction` | ניחשת נכון! +{n} נק\' | Correct! +{n} pts |
| `matches.wrongPrediction` | לא ניחשת נכון | Wrong prediction |

## Bracket

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `bracket.title` | שלב הנוקאאוט | Bracket |
| `bracket.r16` | שמינית גמר | Round of 16 |
| `bracket.qf` | רבע גמר | Quarter-Finals |
| `bracket.sf` | חצי גמר | Semi-Finals |
| `bracket.final` | גמר | Final |
| `bracket.champion` | אלוף | Champion |

## Members

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `members.title` | רשימת משתתפים | Members |
| `members.count` | {n} משתתפים | {n} members |
| `members.pending` | {n} ממתינים לאישור | {n} pending approval |
| `members.empty` | אין משתתפים בהימור | No members yet |

## Admin

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `admin.title` | אזור מארגן | Admin area |
| `admin.members.title` | ניהול חברים | Manage Members |
| `admin.members.total` | סה"כ | Total |
| `admin.members.pending` | ממתינים | Pending |
| `admin.members.complete` | השלימו | Completed |
| `admin.members.approve` | אשר | Approve |
| `admin.members.reject` | הסר | Remove |
| `admin.members.pendingBadge` | ⏳ ממתין לאישור | ⏳ Pending approval |
| `admin.members.poolLocked` | ההימור נעול - לא ניתן לאשר/לדחות | Pool locked - cannot approve/reject |
| `admin.member.actions` | פעולות | Actions |
| `admin.member.generateCode` | צור קוד שחזור חדש | Generate new recovery code |
| `admin.member.remove` | הסר מההימור | Remove from pool |
| `admin.member.confirmRemove` | להסיר את {name} מההימור? | Remove {name} from the pool? |
| `admin.member.removed` | המשתמש הוסר | Member removed |
| `admin.member.approved` | המשתמש אושר | Member approved |
| `admin.member.rejected` | המשתמש הוסר | Member removed |
| `admin.settings.title` | הגדרות ההימור | Pool Settings |
| `admin.settings.poolStatus` | מצב ההימור | Pool Status |
| `admin.settings.locked` | נעול | Locked |
| `admin.settings.unlocked` | פתוח | Open |
| `admin.settings.lockBtn` | נעל את ההימור | Lock pool |
| `admin.settings.unlockBtn` | פתח את ההימור | Unlock pool |
| `admin.settings.lockDesc` | כשנעול - אי אפשר לשנות בחירות. אישור חברים חדשים מבוטל. | When locked - predictions can\'t be changed. New member approval disabled. |
| `admin.settings.scoring` | ניקוד | Scoring |
| `admin.settings.scoring.groups` | בית (כל ניחוש נכון) | Group stage (per correct pick) |
| `admin.settings.scoring.r32` | שמינית גמר | Round of 32 |
| `admin.settings.scoring.r16` | שמינית גמר | Round of 16 |
| `admin.settings.scoring.qf` | רבע גמר | Quarter-Finals |
| `admin.settings.scoring.sf` | חצי גמר | Semi-Finals |
| `admin.settings.scoring.final` | גמר | Final |
| `admin.settings.scoring.topScorer` | מלך השערים | Top Scorer |
| `admin.settings.reset` | אפס לברירת מחדל | Reset to default |
| `admin.settings.confirmReset` | לאפס את הניקוד לברירת המחדל? | Reset scoring to default? |

## Sharing / Invite

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `invite.title` | הזמן חברים להימור | Invite friends to pool |
| `invite.desc` | שתף את הקישור הזה כדי להזמין חברים | Share this link to invite friends |
| `invite.code` | קוד ההימור | Pool code |
| `invite.link` | קישור הזמנה | Invite link |
| `invite.whatsapp` | WhatsApp | WhatsApp |
| `invite.telegram` | Telegram | Telegram |
| `invite.qr` | QR | QR |
| `invite.copy` | העתק | Copy |
| `invite.shareText` | הצטרף להימור שלי על המונדיאל! | Join my World Cup prediction pool! |

## Help

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `help.title` | עזרה ושאלות נפוצות | Help & FAQ |
| `help.intro` | FriendlyBet הוא משחק חברתי להימור על המונדיאל | FriendlyBet is a social World Cup prediction game |

## Toasts / Messages

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `toast.poolCreated` | ההימור נוצר בהצלחה! | Pool created successfully! |
| `toast.joined` | הצטרפת בהצלחה | Joined successfully |
| `toast.loginSuccess` | התחברת בהצלחה | Logged in successfully |
| `toast.invalidCode` | קוד שגוי | Invalid code |
| `toast.poolNotFound` | ההימור לא נמצא | Pool not found |
| `toast.copyError` | שגיאה בהעתקה | Copy failed |
| `toast.copied` | הועתק ללוח | Copied to clipboard |
| `toast.recoveryNew` | קוד שחזור חדש נוצר | New recovery code generated |
| `toast.offline` | אתה כרגע במצב לא מקוון | You are offline |
| `toast.online` | חזרת למצב מקוון | Back online |
| `toast.poolLocked` | ההימור נעול | Pool locked |
| `toast.poolUnlocked` | ההימור נפתח | Pool unlocked |
| `toast.loadError` | שגיאה בטעינה | Failed to load |

## Confirmations

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `confirm.leave` | להתנתק מההימור? | Leave the pool? |
| `confirm.leaveDesc` | תוכל לחזור בעזרת קוד השחזור. | You can return with your recovery code. |
| `confirm.alreadyInPool` | אתה כבר בהימור אחר | You\'re already in another pool |
| `confirm.alreadyInPoolDesc` | כדי להצטרף ל-{name}, עליך להתנתק קודם מההימור הנוכחי. | To join {name}, you must leave your current pool first. |

## Dates / Time

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `date.today` | היום | Today |
| `date.tomorrow` | מחר | Tomorrow |
| `date.yesterday` | אתמול | Yesterday |

## Country Names

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `country.ARG` | ארגנטינה | Argentina |
| `country.BRA` | ברזיל | Brazil |
| `country.FRA` | צרפת | France |
| `country.ENG` | אנגליה | England |
| `country.ESP` | ספרד | Spain |
| `country.POR` | פורטוגל | Portugal |
| `country.NED` | הולנד | Netherlands |
| `country.GER` | גרמניה | Germany |
| `country.BEL` | בלגיה | Belgium |
| `country.CRO` | קרואטיה | Croatia |
| `country.URU` | אורוגוואי | Uruguay |
| `country.USA` | ארה"ב | USA |
| `country.MEX` | מקסיקו | Mexico |
| `country.SUI` | שוויץ | Switzerland |
| `country.AUT` | אוסטריה | Austria |
| `country.SWE` | שבדיה | Sweden |
| `country.SEN` | סנגל | Senegal |
| `country.MAR` | מרוקו | Morocco |
| `country.JPN` | יפן | Japan |
| `country.KOR` | דרום קוריאה | South Korea |
| `country.AUS` | אוסטרליה | Australia |
| `country.CAN` | קנדה | Canada |
| `country.UKR` | אוקראינה | Ukraine |
| `country.TUR` | טורקיה | Turkey |
| `country.NOR` | נורווגיה | Norway |
| `country.IRN` | איראן | Iran |
| `country.TUN` | תוניסיה | Tunisia |
| `country.EGY` | מצרים | Egypt |
| `country.CMR` | קמרון | Cameroon |
| `country.GHA` | גאנה | Ghana |
| `country.PAN` | פנמה | Panama |
| `country.JAM` | ג\'מייקה | Jamaica |
| `country.PAR` | פרגוואי | Paraguay |
| `country.NZL` | ניו זילנד | New Zealand |
| `country.UZB` | אוזבקיסטן | Uzbekistan |
| `country.IRQ` | עיראק | Iraq |
| `country.SAU` | סעודיה | Saudi Arabia |
| `country.JOR` | ירדן | Jordan |
| `country.RSA` | דרום אפריקה | South Africa |
| `country.ALG` | אלג\'יריה | Algeria |
| `country.CZE` | צ\'כיה | Czechia |
| `country.HAI` | האיטי | Haiti |
| `country.BIH` | בוסניה | Bosnia |
| `country.CPV` | כף ורדה | Cape Verde |
| `country.COD` | קונגו | DR Congo |
| `country.CIV` | חוף השנהב | Ivory Coast |
| `country.QAT` | קטאר | Qatar |
| `country.SCO` | סקוטלנד | Scotland |
| `country.CUR` | קוראסאו | Curaçao |

## Extended common

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `common.tournament` | טורניר | Tournament |
| `common.tournamentName` | מונדיאל 2026 | World Cup 2026 |
| `common.status` | סטטוס | Status |
| `common.matches` | משחקים | matches |
| `common.members` | חברים | members |
| `common.minutes` | דקות | minutes |
| `common.hours` | שעות | hours |
| `common.justNow` | הרגע | just now |
| `common.refresh` | רענן | Refresh |
| `common.zoom` | הגדל | Zoom |
| `common.invite` | הזמן | Invite |
| `common.saveExit` | שמור וצא | Save & exit |
| `common.simulator` | סימולטור | Simulator |
| `common.processing` | מעבד... | Processing... |

## PWA install banner

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `pwa.title` | התקן את האפליקציה | Install the app |
| `pwa.text` | גישה מהירה מהמסך הראשי, ללא דפדפן | Quick access from home screen, no browser |
| `pwa.install` | התקן | Install |
| `pwa.installed` | 🎉 האפליקציה הותקנה! | 🎉 App installed! |
| `pwa.installing` | 🎉 מתקין... | 🎉 Installing... |
| `pwa.iosInstructions` | להתקנת האפליקציה ב-iPhone/iPad:\n\n1. לחץ על כפתור השיתוף ⎙ למטה\n2. גלול ובחר "הוסף למסך הבית"\n3. לחץ "הוסף"\n\nהאפליקציה תופיע במסך הבית כמו אפליקציה רגילה! | To install on iPhone/iPad:\n\n1. Tap the share button ⎙ below\n2. Scroll and choose "Add to Home Screen"\n3. Tap "Add"\n\nThe app will appear on your home screen like a normal app! |
| `pwa.desktopInstructions` | להתקנת האפליקציה:\n\n• Chrome/Edge: יופיע כפתור "התקן" בשורת הכתובת\n• Firefox: לחץ על שלוש הנקודות → "התקן"\n• או הוסף לסימניות | To install the app:\n\n• Chrome/Edge: An "Install" button appears in the address bar\n• Firefox: Tap the three dots → "Install"\n• Or add to bookmarks |
| `pwa.updateAvailable` | 🔄 גרסה חדשה זמינה | 🔄 New version available |
| `pwa.update` | עדכן | Update |
| `pwa.online` | 🌐 מחובר לאינטרנט | 🌐 Back online |
| `pwa.offline` | אין חיבור לאינטרנט - חלק מהפיצ\'רים מוגבלים | No internet — some features are limited |

## Pool found screen

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `poolFound.title` | פרטי ההימור | Pool details |
| `poolFound.membersValue` | {n} חברים | {n} members |
| `poolFound.statusOpen` | פתוח להצטרפות | Open to join |
| `poolFound.statusGroupLocked` | שלב הבתים סגור | Group stage closed |
| `poolFound.statusKnockout` | בשלב הנוקאאוט | In knockout stage |
| `poolFound.statusFinished` | הסתיים | Finished |

## Nickname screen

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `nickname.step` | שלב 1 מתוך 2 | Step 1 of 2 |
| `nickname.title` | איך נקרא לך? | What should we call you? |
| `nickname.subtitle` | הכינוי יוצג בלוח הדירוגים | Your nickname appears on the leaderboard |
| `nickname.placeholder` | לדוגמה: דני | e.g. Danny |
| `nickname.checking` | בודק זמינות... | Checking availability... |
| `nickname.taken` | הכינוי תפוס, נסה אחר | Nickname taken, try another |
| `nickname.available` | הכינוי פנוי! | Nickname available! |
| `nickname.errorRequired` | נא להזין כינוי | Please enter a nickname |
| `nickname.errorMin` | הכינוי חייב להיות לפחות {n} תווים | Nickname must be at least {n} characters |
| `nickname.errorMax` | הכינוי לא יכול לחרוג מ-{n} תווים | Nickname must be at most {n} characters |
| `nickname.errorTaken` | הכינוי כבר תפוס בהימור הזה | Nickname already taken in this pool |

## Recovery code creation

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `recoveryCode.step` | שלב 2 מתוך 2 | Step 2 of 2 |
| `recoveryCode.sendSelf` | שלח לעצמי | Send to myself |
| `recoveryCode.warningTitle` | חשוב! | Important! |
| `recoveryCode.warningText` | ללא הקוד הזה לא תוכל להתחבר חזרה. שמור אותו במקום בטוח. | Without this code you cannot log back in. Keep it safe. |
| `recoveryCode.saved` | שמרתי, המשך | Saved, continue |
| `recoveryCode.shareText` | 🔑 קוד השחזור שלי ל-{poolName}:\n\n{code}\n\n⚠️ שמור הודעה זו - תזדקק לקוד אם תרצה להתחבר מחדש!\n\n{url} | 🔑 My recovery code for {poolName}:\n\n{code}\n\n⚠️ Keep this message — you\'ll need the code to log back in!\n\n{url} |
| `recoveryCode.copiedSave` | קוד השחזור הועתק! שמור אותו במקום בטוח | Recovery code copied! Keep it safe |
| `recoveryCode.copied` | קוד השחזור הועתק! | Recovery code copied! |

## Create pool

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `createPool.step1` | שלב 1 מתוך 3 | Step 1 of 3 |
| `createPool.title1` | איך נקרא להימור? | What should we call the pool? |
| `createPool.subtitle1` | השם שיוצג לכל המשתתפים | The name everyone will see |
| `createPool.placeholder` | לדוגמה: חברים מהעבודה | e.g. Coworkers |
| `createPool.suggestions` | הצעות מהירות: | Quick suggestions: |
| `createPool.suggestion1` | חברים מהעבודה | Work friends |
| `createPool.suggestion2` | המשפחה | Family |
| `createPool.suggestion3` | חברים מהצבא | College buddies |
| `createPool.suggestion4` | השכונה | The squad |
| `createPool.suggestion5` | התיכון | Old school |
| `createPool.suggestion6` | מילואים | Neighbors |
| `createPool.suggestion7` | קבוצת הוואטסאפ | The group chat |
| `createPool.suggestion8` | האוניברסיטה | Roommates |
| `createPool.errorRequired` | נא להזין שם להימור | Please enter a pool name |
| `createPool.errorMin` | השם חייב להיות לפחות {n} תווים | Name must be at least {n} characters |

## Admin nickname

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `adminNickname.step` | שלב 2 מתוך 3 | Step 2 of 3 |
| `adminNickname.subtitle` | הכינוי שלך כמארגן וגם כמשתתף | Your nickname — as admin AND member |
| `adminNickname.placeholder` | לדוגמה: יוסי | e.g. John |
| `adminNickname.permTitle` | הרשאות המארגן | Admin permissions |
| `adminNickname.perm1` | ניהול חברי ההימור | Manage pool members |
| `adminNickname.permRules` | קביעת חוקי ההימור | Set the betting rules |
| `adminNickname.perm2` | אישור משתמשים חדשים | Approve new users |
| `adminNickname.perm3` | שחזור קודים אבודים | Recover lost codes |
| `adminNickname.perm4` | צפייה בכל ההימורים | View all predictions |
| `adminNickname.perm5` | אתה גם משתתף בהימור | You also participate in the pool |
| `adminNickname.errorRequired` | נא להזין את הכינוי שלך | Please enter your nickname |
| `adminNickname.createBtn` | צור הימור | Create pool |

## Share pool

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `sharePool.created` | ההימור נוצר! | Pool created! |
| `sharePool.awesome` | מעולה! | Awesome! |
| `sharePool.subtitle` | ההימור נוצר בהצלחה | Pool created successfully |
| `sharePool.promptTitle` | ההימור נוצר עם חוקי Golazo (ברירת מחדל) | Pool created with Golazo rules (default) |
| `sharePool.promptSubtitle` | תוכל לערוך את כל החוקים לפני שמישהו מצטרף | You can edit all rules before anyone joins |
| `sharePool.editSettings` | ערוך הגדרות | Edit settings |
| `sharePool.divider` | או פשוט שתף ותתחיל לשחק | Or just share and start playing |
| `sharePool.whatsapp` | שתף ב-WhatsApp | Share on WhatsApp |
| `sharePool.telegram` | שתף ב-Telegram | Share on Telegram |
| `sharePool.copyLink` | העתק קישור | Copy link |
| `sharePool.toDashboard` | לדשבורד שלי | To my dashboard |
| `sharePool.welcomeToast` | ברוך הבא ל-{name}! | Welcome to {name}! |
| `sharePool.adminCodeAlert` | 🔑 קוד השחזור שלך כמארגן:\n\n{code}\n\nשמור אותו במקום בטוח! בלעדיו לא תוכל להתחבר חזרה. | 🔑 Your admin recovery code:\n\n{code}\n\nKeep it safe! Without it you cannot log back in. |
| `sharePool.shareText` | הוזמנת להצטרף להימור "{poolName}" 🏆\n\nבא ננחש ביחד את מונדיאל 2026 — חינם לגמרי, רק בשביל הכיף והכבוד.\n\nקוד הצטרפות: {code}\n👉 {url}\n\n⚽ FriendlyBet — הימור חברים על מונדיאל 2026 | You\'ve been invited to the "{poolName}" pool 🏆\n\nLet\'s predict World Cup 2026 together — totally free, just bragging rights on the line.\n\nJoin code: {code}\n👉 {url}\n\n⚽ FriendlyBet — World Cup Predictions with Friends |

## Pool settings

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `poolSettings.lockedTitle` | החוקים נעולים | Rules locked |
| `poolSettings.lockedText` | משתתפים כבר הצטרפו - לא ניתן לשנות חוקים | Members already joined — rules cannot be changed |
| `poolSettings.poolInfo` | פרטי ההימור | Pool info |
| `poolSettings.bettingMode` | שיטת ההימור | Betting mode |
| `poolSettings.bettingModeLabel` | מצב | Mode |
| `poolSettings.bettingModeHelp` | הימור חד-שלבי: בתים + נוקאאוט + מלך שערים, הכל לפני תחילת הטורניר. | Single-phase: groups + knockout + top scorer, all picked before the tournament starts. |
| `poolSettings.scoringReadOnly` | חוקי הניקוד נקבעו ביצירת ההימור ולא ניתנים לשינוי. | Scoring rules are locked at pool creation and cannot be changed. |
| `poolSettings.poolName` | שם ההימור | Pool name |
| `poolSettings.poolCode` | קוד ההימור | Pool code |
| `poolSettings.poolMembers` | משתתפים | Members |
| `poolSettings.format` | מבנה ההימור | Pool format |
| `poolSettings.stages` | מספר שלבי הימור | Number of stages |
| `poolSettings.stages2` | 2 שלבים | 2 stages |
| `poolSettings.stages6` | 6 שלבים | 6 stages |
| `poolSettings.help2` | 2 שלבים: בתים + נוקאאוט | 2 stages: Groups + Knockout |
| `poolSettings.help6` | 6 שלבים: בתים + R32 + R16 + רבע + חצי + גמר | 6 stages: Groups + R32 + R16 + QF + SF + Final |
| `poolSettings.groupBetting` | איך מהמרים על בתים | Group betting style |
| `poolSettings.pickAdvancing` | בחירת עולות | Pick advancing |
| `poolSettings.fullRanking` | דירוג 1-4 | Rank 1-4 |
| `poolSettings.helpPickAdvancing` | בחירת 2-3 קבוצות שיעלו מכל בית | Pick 2-3 teams to advance from each group |
| `poolSettings.helpFullRanking` | דירוג מלא של כל הקבוצות בבית | Full ranking of all teams in the group |
| `poolSettings.multipliers` | מכפילי סיכון | Risk multipliers |
| `poolSettings.multipliersActive` | מכפילים פעילים | Multipliers active |
| `poolSettings.multipliersHelp` | מי שמסתכן יותר — מרוויח יותר 🎲 | Risk more — earn more 🎲 |
| `poolSettings.multFav` | פייבוריטית | Favorite |
| `poolSettings.multCont` | מתמודדת | Contender |
| `poolSettings.multUnd` | אנדרדוג | Underdog |
| `poolSettings.scoring` | ניקוד לכל שלב | Points per stage |
| `poolSettings.scoreGroupStage` | שלב הבתים | Group stage |
| `poolSettings.scoreR32` | סבב 32 | Round of 32 |
| `poolSettings.scoreR16` | שמינית גמר | Round of 16 |
| `poolSettings.scoreQF` | רבע גמר | Quarter-Finals |
| `poolSettings.scoreSF` | חצי גמר | Semi-Finals |
| `poolSettings.scoreFinal` | גמר | Final |
| `poolSettings.resetGolazo` | איפוס לחוקי Golazo | Reset to Golazo rules |
| `poolSettings.topScorer` | מלך השערים | Top Scorer |
| `poolSettings.topScorerActive` | פעיל | Active |
| `poolSettings.bonusPoints` | בונוס נקודות | Bonus points |
| `poolSettings.members` | משתתפים | Members |
| `poolSettings.limitMembers` | הגבלת משתתפים | Limit members |
| `poolSettings.maxMembers` | מקסימום משתתפים | Max members |
| `poolSettings.approveBefore` | אישור משתמשים לפני הימור | Approve users before betting |
| `poolSettings.approveBeforeHelp` | הגנה מבוטים - תאשר כל משתתף ידנית לפני שיוכל להמר | Anti-bot protection — approve each member manually before they can bet |
| `poolSettings.saveBtn` | שמור הגדרות | Save settings |
| `poolSettings.dangerZone` | אזור מסוכן | Danger zone |
| `poolSettings.deletePool` | מחק את ההימור | Delete pool |
| `poolSettings.deleteHelp` | מחיקה היא פעולה לא הפיכה. כל הנתונים יימחקו לצמיתות. | Deletion is irreversible. All data will be lost forever. |
| `poolSettings.savingToast` | שומר הגדרות... | Saving settings... |
| `poolSettings.savedToast` | ההגדרות נשמרו בהצלחה! ✅ | Settings saved! ✅ |
| `poolSettings.saveError` | שגיאה בשמירה: {msg} | Save failed: {msg} |
| `poolSettings.poolNameShort` | שם ההימור קצר מדי | Pool name too short |
| `poolSettings.notAdmin` | רק המארגן יכול לערוך הגדרות | Only the admin can edit settings |
| `poolSettings.loadError` | שגיאה בטעינת ההגדרות | Failed to load settings |
| `poolSettings.notFound` | לא נמצא הימור | Pool not found |
| `poolSettings.resetToast` | הוחזר לחוקי Golazo המקוריים | Reset to original Golazo rules |
| `poolSettings.bonusToast` | בונוס מלך השערים: {n} נקודות | Top scorer bonus: {n} points |
| `poolSettings.deleteWarning` | ⚠️ אזהרה!\n\nאתה עומד למחוק את ההימור "{name}".\n\nכל הנתונים, ההימורים והניקוד יימחקו לצמיתות.\n\nפעולה זו לא ניתנת לביטול.\n\nהאם להמשיך? | ⚠️ Warning!\n\nYou are about to delete the pool "{name}".\n\nAll data, predictions and scores will be permanently lost.\n\nThis cannot be undone.\n\nContinue? |
| `poolSettings.deletePrompt` | כדי לאשר, הקלד את שם ההימור:\n"{name}" | To confirm, type the pool name:\n"{name}" |
| `poolSettings.deleteCancelled` | המחיקה בוטלה | Deletion cancelled |
| `poolSettings.deleteError` | שגיאה במחיקה: {msg} | Deletion failed: {msg} |
| `poolSettings.deletedToast` | ההימור נמחק | Pool deleted |
| `poolSettings.leaveConfirm` | האם להתנתק מההימור?\n\nהקוד שלך עדיין יעבוד - תוכל להתחבר שוב עם קוד השחזור. | Leave the pool?\n\nYour code still works — you can log back in with the recovery code. |
| `poolSettings.leftToast` | התנתקת מההימור | You left the pool |

## Group betting

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `groups.titleGroup` | בית {letter} | Group {letter} |
| `groups.stepProgress` | בית {current} מתוך {total} | Group {current} of {total} |
| `groups.totalPicks` | סך הכל הימרת על | Total picks |
| `groups.questionHeader` | על מי תהמר בבית | Who advances from group |
| `groups.subtitleInline` | בחר 2 או 3 קבוצות שיעלו לשלב הבא | Pick 2 or 3 teams to advance |
| `groups.quickJump` | קפיצה מהירה לבית | Quick jump to group |
| `groups.prevGroup` | בית {letter} | Group {letter} |
| `groups.nextGroup` | בית {letter} | Group {letter} |
| `groups.tierFavorite` | ⭐ פייבוריטית ×1 | ⭐ Favorite ×1 |
| `groups.tierContender` | ⚔️ מתמודדת ×1.5 | ⚔️ Contender ×1.5 |
| `groups.tierUnderdog` | 🐶 אנדרדוג ×2 | 🐶 Underdog ×2 |
| `groups.pointsForPosition` | #{pos}: {pts} נק׳ | #{pos}: {pts} pts |
| `groups.multStartsKO` | מכפילי הסיכון מתחילים להשפיע משלב הנוקאאוט | Risk multipliers kick in from the knockout stage |
| `groups.pointsPerAdvancingTeam` | כל קבוצה שעולה: {pts} נק׳ × מכפיל הסיכון שלה | Each advancing team: {pts} pts × its risk multiplier |
| `groups.tooltipAdvanced` | הקבוצה עלתה! | Team advanced! |
| `groups.tooltipEliminated` | הקבוצה הודחה | Team eliminated |
| `groups.maxReachedToast` | כבר בחרת 3 קבוצות. הסר אחת לפני שתוסיף עוד | Already picked 3 teams. Remove one before adding another |
| `groups.pickSubtitleDefault` | בחר 2 או 3 קבוצות מהבית הזה | Pick 2 or 3 teams from this group |
| `groups.pickOneOnly` | ⚠️ בחרת רק קבוצה אחת - צריך 2 או 3 | ⚠️ You picked only 1 — need 2 or 3 |
| `groups.pickedTwo` | ✓ בחרת 2 קבוצות בבית הזה | ✓ Picked 2 teams in this group |
| `groups.pickedThree` | ✓ בחרת 3 קבוצות בבית הזה | ✓ Picked 3 teams in this group |
| `groups.validationRemaining` | נשאר עוד {n} קבוצות לבחור | {n} more teams to pick |
| `groups.validationDone` | 🎉 הושלם! 32 קבוצות נבחרו | 🎉 Done! 32 teams picked |
| `groups.validationProblem` | בעיה: לפחות בית אחד עם 0 או 1 קבוצות בלבד | Issue: at least one group has 0 or 1 picks |
| `groups.validationTooMany` | יותר מדי! {n} קבוצות מעל המקסימום | Too many! {n} over the max |
| `groups.needMore` | בחר עוד {n} קבוצ{plural} כדי להמשיך | Pick {n} more team{plural} to continue |
| `groups.mustPickTwo` | חייב לבחור לפחות 2 קבוצות בבית {letter} כדי להמשיך | You must pick at least 2 teams in group {letter} to continue |
| `groups.saveError` | שגיאה בשמירת ההימור | Failed to save predictions |
| `groups.savedOk` | ההימור נשמר ✓ | Saved ✓ |
| `groups.exitConfirm` | יש לך {n} הימורים שמורים. צא מבלי לסיים? | You have {n} saved picks. Exit without finishing? |
| `groups.exactly32` | צריך בדיוק 32 קבוצות (יש {n}) | Need exactly 32 teams (you have {n}) |
| `groups.eachGroup2or3` | בכל בית חייבים להיות 2 או 3 קבוצות | Each group must have 2 or 3 teams |
| `groups.savingToast` | שומר הימור... | Saving predictions... |
| `groups.loadingTeams` | טוען את הקבוצות... | Loading teams... |
| `groups.teamsSyncing` | הקבוצות עדיין בסנכרון - נסה שוב בעוד מספר דקות | Teams still syncing — try again in a few minutes |

## Betting complete

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `complete.title` | כל הכבוד! | Great job! |
| `complete.subtitle` | השלמת את ההימור על שלב הבתים | You completed group-stage predictions |
| `complete.teamsPicked` | קבוצות שבחרת | Teams picked |
| `complete.maxPoints` | סיכוי לניקוד מקסימלי | Max possible score |
| `complete.info` | ההימור נשמר. תוכל לערוך אותו עד לפני המשחק הראשון | Saved. You can edit until the first match |
| `complete.toDashboard` | לדשבורד שלי | Go to dashboard |
| `complete.review` | סקור את ההימורים שלי | Review my picks |

## Knockout extras

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `knockoutEx.r32Short` | סבב 32 | R32 |
| `knockoutEx.r16Short` | שמינית | R16 |
| `knockoutEx.qfShort` | רבע | QF |
| `knockoutEx.sfShort` | חצי | SF |
| `knockoutEx.finalShort` | גמר | Final |
| `knockoutEx.r32Full` | סבב 32 | Round of 32 |
| `knockoutEx.r16Full` | שמינית הגמר | Round of 16 |
| `knockoutEx.qfFull` | רבע הגמר | Quarter-Finals |
| `knockoutEx.sfFull` | חצי הגמר | Semi-Finals |
| `knockoutEx.finalFull` | הגמר | Final |
| `knockoutEx.pointsPerPick` | {n} נקודות לכל ניחוש נכון | {n} points per correct pick |
| `knockoutEx.totalPicks` | סה"כ הימרת על | Total picks |
| `knockoutEx.emptyTitle` | הסבב הזה ייפתח בהמשך | This round opens later |
| `knockoutEx.emptyText` | קודם השלם את הסבבים הקודמים | Complete earlier rounds first |
| `knockoutEx.finishBtn` | סיים את הימור הנוקאאוט | Finish knockout |
| `knockoutEx.bracketView` | תצוגת ההגרלה | Bracket view |
| `knockoutEx.matchNum` | משחק {n} | Match {n} |
| `knockoutEx.finalLabel` | הגמר 🏆 | Final 🏆 |
| `knockoutEx.winnerLine` | המנצח: <strong>אלוף המונדיאל!</strong> | Winner: <strong>World Cup champion!</strong> |
| `knockoutEx.correctLine` | ניחשת נכון! +{n} נק\' | Correct! +{n} pts |
| `knockoutEx.wonLine` | {name} ניצח | {name} won |
| `knockoutEx.opponent` | היריב | opponent |
| `knockoutEx.equalizer` | משווה | matches |
| `knockoutEx.pointsValue` | {n} נק\' | {n} pts |
| `knockoutEx.ifCorrect` | אם תנחש נכון | if you pick correctly |
| `knockoutEx.tbdTeam` | להיקבע | TBD |
| `knockoutEx.savedOk` | הימור הנוקאאוט נשמר ✓ | Knockout picks saved ✓ |
| `knockoutEx.completed` | הימור הנוקאאוט הושלם! 🏆 | Knockout predictions complete! 🏆 |
| `knockoutEx.needGroups` | צריך לסיים קודם את שלב הבתים (32 קבוצות) | Finish the group stage first (32 teams) |
| `knockoutEx.loadingKO` | טוען את שלב הנוקאאוט... | Loading knockout stage... |
| `knockoutEx.loadError` | שגיאה בטעינת הקבוצות | Failed to load teams |
| `knockoutEx.matchesProgress` | {n}/31 משחקים | {n}/31 matches |

## Bracket view

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `bracketView.title` | עץ ההגרלה | Bracket |
| `bracketView.full` | תצוגה מלאה | Full view |
| `bracketView.leftSide` | חצי שמאל | Left half |
| `bracketView.rightSide` | חצי ימין | Right half |
| `bracketView.scrollHint` | ↔ גלול הצידה כדי לראות את שני הצדדים | ↔ Scroll sideways to see both halves |
| `bracketView.hint` | גרור עם האצבע כדי לראות את כל הסבבים | Swipe to see all rounds |
| `bracketView.r32` | R32 | R32 |
| `bracketView.r16` | שמינית | R16 |
| `bracketView.qf` | רבע | QF |
| `bracketView.sf` | חצי | SF |
| `bracketView.final` | 🏆 גמר | 🏆 Final |
| `bracketView.championLabel` | 🏆 אלוף 🏆 | 🏆 Champion 🏆 |
| `bracketView.tbd` | להיקבע | TBD |

## Simulator

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `simulatorEx.titleFull` | סימולטור הסיכון | Risk Simulator |
| `simulatorEx.subtitle` | ניתוח אסטרטגיית ההימור שלך | Your strategy analysis |
| `simulatorEx.expectedScore` | ניקוד צפוי | Expected score |
| `simulatorEx.avgProjection` | צפי ממוצע | Average projection |
| `simulatorEx.maxPossible` | מקסימום אפשרי | Max possible |
| `simulatorEx.riskLevel` | רמת סיכון | Risk level |
| `simulatorEx.riskSafe` | 🛡️ בטוח | 🛡️ Safe |
| `simulatorEx.riskBalanced` | ⚡ מאוזן | ⚡ Balanced |
| `simulatorEx.riskRisky` | 🎲 מסוכן | 🎲 Risky |
| `simulatorEx.riskDefault` | בחר משחקים כדי לראות ניתוח | Pick matches to see analysis |
| `simulatorEx.byStage` | פירוט לפי שלב | Breakdown by stage |
| `simulatorEx.recommendDefault` | בחר משחקים בנוקאאוט כדי לקבל המלצות | Pick knockout matches to get recommendations |
| `simulatorEx.riskDescSafe` | 🛡️ אסטרטגיה בטוחה - אתה מהמר על הפייבוריטיות | 🛡️ Safe strategy — picking the favorites |
| `simulatorEx.riskDescBalanced` | ⚡ אסטרטגיה מאוזנת - שילוב של בטוח ויצירתי | ⚡ Balanced strategy — mix of safe and creative |
| `simulatorEx.riskDescRisky` | 🎲 אסטרטגיה אגרסיבית - הרבה הימורים מסוכנים | 🎲 Aggressive strategy — lots of risky bets |
| `simulatorEx.riskDescVery` | 🔥 אסטרטגיה ספורטיבית - הולך על הכל! | 🔥 All-in strategy — going for it! |
| `simulatorEx.recEarly` | התחל לבחור משחקים והסימולטור ינתח את האסטרטגיה שלך | Start picking matches and the simulator will analyze your strategy |
| `simulatorEx.recContinue` | המשך לבחור כדי לראות תמונה מלאה של הסיכויים שלך | Keep picking to see your full odds |
| `simulatorEx.recTooSafe` | אסטרטגיה בטוחה תיתן צפי ניקוד יציב, אבל קשה לעקוף יריבים שיסתכנו ויצליחו. נסה להוסיף 1-2 הימורים נועזים יותר. | Safe strategies give steady scores but are hard to win with. Try 1-2 bolder picks. |
| `simulatorEx.recTooRisky` | אסטרטגיה מסוכנת מאוד! פוטנציאל ענק לניקוד גבוה, אבל סיכוי גבוה לטעויות. שקול לחזור לבטוח ב-1-2 שלבים מאוחרים. | Very risky! Huge upside but high chance of mistakes. Consider safer picks in later rounds. |
| `simulatorEx.recBalanced` | איזון מצוין! יש לך פוטנציאל לניקוד גבוה עם סיכון מתון. זאת אסטרטגיה חכמה. | Excellent balance! High potential with moderate risk. Smart strategy. |

## Matches extras

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `matchesEx.filterUpcoming` | קרובים | Upcoming |
| `matchesEx.filterFinished` | הסתיימו | Finished |
| `matchesEx.filterLive` | 🔴 חי | 🔴 Live |
| `matchesEx.live` | משחק חי | Live |
| `matchesEx.finished` | הסתיים | Final |
| `matchesEx.halftime` | מחצית | Half-time |
| `matchesEx.lastUpdated` | עודכן: {time} | Updated: {time} |
| `matchesEx.notSynced` | עוד לא סונכרן | Not synced yet |
| `matchesEx.emptyTitle` | המשחקים עוד לא פורסמו | Matches not yet published |
| `matchesEx.emptyText` | לוח המשחקים יתעדכן ברגע שפיפ"א תפרסם את ה-Draw הרשמי | Schedule will update once FIFA publishes the official Draw |
| `matchesEx.loadingMatches` | טוען משחקים... | Loading matches... |
| `matchesEx.noInCategory` | אין משחקים בקטגוריה הזאת | No matches in this category |
| `matchesEx.dateUnknown` | תאריך לא ידוע | Date unknown |
| `matchesEx.past` | עבר | past |
| `matchesEx.inMinutes` | בעוד {n} דקות | in {n} minutes |
| `matchesEx.inHours` | בעוד {n} שעות | in {n} hours |
| `matchesEx.inDays` | בעוד {n} ימים | in {n} days |
| `matchesEx.minutesAgo` | לפני {n} דקות | {n} minutes ago |
| `matchesEx.hoursAgo` | לפני {n} שעות | {n} hours ago |
| `matchesEx.daysAgo` | לפני {n} ימים | {n} days ago |
| `matchesEx.syncing` | מסנכרן משחקים... | Syncing matches... |
| `matchesEx.synced` | עודכן ✓ | Updated ✓ |
| `matchesEx.loadError` | שגיאה בטעינת המשחקים | Failed to load matches |
| `matchesEx.stageGroup` | בית {letter} | Group {letter} |
| `matchesEx.stageR16` | שמינית הגמר | Round of 16 |
| `matchesEx.stageQF` | רבע הגמר | Quarter-Finals |
| `matchesEx.stageSF` | חצי הגמר | Semi-Finals |
| `matchesEx.stageFinal` | 🏆 הגמר | 🏆 Final |
| `matchesEx.stageThird` | מקום 3 | 3rd place |

## Admin members

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `adminMembersEx.lockedTitle` | ההימור נעול | Pool locked |
| `adminMembersEx.lockedText` | אין אפשרות להצטרף עם קוד ההזמנה | No new members can join with the invite code |
| `adminMembersEx.unlockBtn` | בטל נעילה | Unlock |
| `adminMembersEx.openTitle` | ההימור פתוח להצטרפות | Pool open to join |
| `adminMembersEx.openText` | חברים חדשים יכולים להצטרף עם קוד ההזמנה | Members can join with the invite code |
| `adminMembersEx.lockBtn` | נעל | Lock |
| `adminMembersEx.notAdmin` | 🚫 רק המארגן יכול לגשת לאזור הזה | 🚫 Only the admin can access this area |
| `adminMembersEx.notAdminAction` | 🚫 רק המארגן יכול לעשות זאת | 🚫 Only the admin can do that |
| `adminMembersEx.pendingCount` | יש <span id="admin-pending-count">{n}</span> חברים שממתינים לאישור | <span id="admin-pending-count">{n}</span> members pending approval |
| `adminMembersEx.pendingSubtitle` | הם יכולים לשחק - אבל מומלץ לאשר/להסיר אותם | They can play — but it\'s recommended to approve/remove them |
| `adminMembersEx.members` | חברים | Members |
| `adminMembersEx.pickedGroups` | בחרו בתים | Picked groups |
| `adminMembersEx.pickedKO` | בחרו נוקאאוט | Picked knockout |
| `adminMembersEx.adminBadge` | מארגן ✓ | Admin ✓ |
| `adminMembersEx.pendingBadge` | ⏳ ממתין לאישור | ⏳ Pending approval |
| `adminMembersEx.approve` | אשר | Approve |
| `adminMembersEx.remove` | הסר | Remove |
| `adminMembersEx.groupsPicks` | בתים: {n} {check} | Groups: {n} {check} |
| `adminMembersEx.koPicks` | נוקאאוט: {n}/16 {check} | Knockout: {n}/16 {check} |
| `adminMembersEx.approvedToast` | ✓ {name} אושר | ✓ {name} approved |
| `adminMembersEx.approveError` | שגיאה באישור | Approval failed |
| `adminMembersEx.confirmRemoveAll` | להסיר את {name} מההימור?\n\nכל ההימורים שלו יימחקו.\nהפעולה לא ניתנת לביטול. | Remove {name} from the pool?\n\nAll their picks will be deleted.\nThis cannot be undone. |
| `adminMembersEx.removedToast` | {name} הוסר | {name} removed |
| `adminMembersEx.removeError` | שגיאה בהסרה | Removal failed |
| `adminMembersEx.confirmAction` | האם אתה בטוח שברצונך {action} את ההימור? | Are you sure you want to {action} the pool? |
| `adminMembersEx.actionLock` | לנעול | lock |
| `adminMembersEx.actionUnlock` | לפתוח | unlock |
| `adminMembersEx.poolLocked` | 🔒 ההימור ננעל | 🔒 Pool locked |
| `adminMembersEx.poolUnlocked` | 🔓 ההימור נפתח | 🔓 Pool unlocked |
| `adminMembersEx.toggleError` | שגיאה בעדכון מצב ההימור | Failed to update pool state |
| `adminMembersEx.loadError` | שגיאה בטעינת חברים | Failed to load members |
| `adminMembersEx.memberJoinedMeta` | הצטרף ב-{date} · {g} בתים · {k} נוקאאוט | Joined {date} · {g} groups · {k} knockout |
| `adminMembersEx.confirmNewCode` | האם ליצור קוד שחזור חדש עבור {name}?\n\nהקוד הישן יבוטל מיד. תצטרך לשלוח לו את הקוד החדש בעצמך. | Generate a new recovery code for {name}?\n\nThe old code is revoked immediately. You\'ll have to send the new code yourself. |
| `adminMembersEx.newCodeMsg` | ✅ קוד שחזור חדש נוצר עבור {name}:\n\n{code}\n\n📋 הקוד יועתק ללוח שלך כשתלחץ "אישור".\nשלח אותו ל-{name} בהודעה פרטית.\n\n⚠️ הקוד הישן בוטל ולא יעבוד יותר. | ✅ New recovery code for {name}:\n\n{code}\n\n📋 The code will be copied to your clipboard when you tap OK.\nSend it to {name} privately.\n\n⚠️ The old code is revoked and will no longer work. |
| `adminMembersEx.newCodeError` | שגיאה ביצירת קוד | Failed to generate code |
| `adminMembersEx.newCodeCopied` | 🔑 קוד חדש נוצר והועתק | 🔑 New code generated and copied |
| `adminShareCode.title` | קוד שחזור חדש מוכן | New recovery code ready |
| `adminShareCode.subtitle` | שלח את הקוד ל-{name} ב-WhatsApp או Telegram, או העתק את הקישור הישיר | Send the code to {name} on WhatsApp or Telegram, or copy the direct link |
| `adminShareCode.codeLabel` | הקוד החדש | New code |
| `adminShareCode.message` | היי {name}! הקוד שלך להימור "{pool}" עודכן. קוד שחזור: {code}\nאו פשוט פתח את הקישור: {link} | Hey {name}! Your access code for "{pool}" was reset. Recovery code: {code}\nOr just open this link: {link} |
| `adminShareCode.linkCopied` | ✓ הקישור הועתק | ✓ Link copied |
| `adminMembersEx.confirmDeleteFull` | ⚠️ האם אתה בטוח שברצונך להסיר את {name} מההימור?\n\nפעולה זו תמחק:\n- כל ההימורים שלו ({g} בתים, {k} נוקאאוט)\n- את החשבון שלו לחלוטין\n\nהפעולה לא ניתנת לביטול. | ⚠️ Are you sure you want to remove {name} from the pool?\n\nThis will delete:\n- All their picks ({g} groups, {k} knockout)\n- Their account entirely\n\nThis cannot be undone. |
| `adminMembersEx.finalConfirm` | אישור אחרון - להסיר את {name}? | Final confirmation — remove {name}? |
| `adminMembersEx.finalRemovedToast` | ✓ {name} הוסר מההימור | ✓ {name} removed from pool |
| `adminMembersEx.finalRemoveError` | שגיאה בהסרת המשתמש | Failed to remove member |

## Admin modal

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `adminModal.newCodeTitle` | צור קוד שחזור חדש | Generate new recovery code |
| `adminModal.newCodeText` | הקוד הישן יבוטל | Old code will be revoked |
| `adminModal.removeTitle` | הסר מההימור | Remove from pool |
| `adminModal.removeText` | פעולה זו תמחק את כל ההימורים שלו | This will delete all their picks |

## Share modal

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `shareModal.subtitle` | שלח להם את הקישור והם יצטרפו בלחיצה אחת | Send them the link and they join in one tap |
| `shareModal.copyHint` | לחץ להעתקה | Tap to copy |
| `shareModal.copyLink` | העתק קישור | Copy link |
| `shareModal.shareMsg` | שתף עם הודעה | Share with message |
| `shareModal.scanCode` | או סרוק את הקוד למטה: | Or scan the code below: |
| `shareModal.inviteUrl` | קישור ההזמנה: | Invite link: |
| `shareModal.generatingQR` | יוצר קוד QR... | Generating QR code... |
| `shareModal.copyLinkOk` | ✓ הקישור הועתק! | ✓ Link copied! |
| `shareModal.copyCodeOk` | ✓ הקוד הועתק! | ✓ Code copied! |
| `shareModal.copyError` | שגיאה בהעתקה | Copy failed |
| `shareModal.joinTitle` | הצטרף ל-{name} | Join {name} |

## Top scorer locked

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `tsLocked.title` | הפיצ\'ר עדיין נעול | Feature still locked |
| `tsLocked.subtitle` | מחכים לפרסום הסגלים הרשמיים | Waiting for the official squad lists |
| `tsLocked.why` | למה זה נעול? | Why is it locked? |
| `tsLocked.whyText` | פיפ"א טרם פרסמה את הסגלים הרשמיים של כל הקבוצות. כל קבוצה צריכה להגיש 26 שחקנים עד 1 ביוני. | FIFA hasn\'t published the official squads yet. Each team must submit 26 players by June 1. |
| `tsLocked.how` | איך זה ייפתח? | How will it unlock? |
| `tsLocked.howText` | המערכת בודקת אוטומטית כל יום. ברגע שהסגלים יתפרסמו - הפיצ\'ר ייפתח לבד עם כל ~736 השחקנים האמיתיים! | The system checks automatically every day. As soon as the squads are released, the feature unlocks with all ~736 real players! |
| `tsLocked.what` | מה אפשר לעשות בינתיים? | What can I do meanwhile? |
| `tsLocked.whatText` | תמלא את הימור הבתים והנוקאאוט. הזמן את החברים. כשהפיצ\'ר ייפתח - תקבל התראה. | Make your group and knockout predictions. Invite friends. You\'ll be notified when this unlocks. |
| `tsLocked.countdown` | ⏱️ עד פתיחת המונדיאל: | ⏱️ Until World Cup kickoff: |
| `tsLocked.openDate` | 11 ביוני 2026 | June 11, 2026 |
| `tsLocked.lastCheck` | בדיקה אחרונה: {time} | Last check: {time} |
| `tsLocked.loadingPlayers` | שגיאה בטעינת שחקנים | Failed to load players |

## Top scorer unlocked

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `tsUnlocked.heroDesc` | מי יבקיע הכי הרבה שערים במונדיאל?<br><strong>+{n} נקודות בונוס</strong> אם תנחש נכון! | Who will score the most goals at the World Cup?<br><strong>+{n} bonus points</strong> if you predict correctly! |
| `tsUnlocked.hintTeam` | {code} (קבוצה) | {code} (team) |
| `tsUnlocked.searchResults` | תוצאות חיפוש לפי "{q}" | Results for "{q}" |
| `tsUnlocked.currentLeaders` | המובילים כרגע | Current leaders |
| `tsUnlocked.forwardsWings` | החלוצים והכנפיים מהקבוצות החזקות | Forwards and wingers from top teams |
| `tsUnlocked.allPlayers` | כל שחקני המונדיאל | All World Cup players |
| `tsUnlocked.showing` | מציג {n} מתוך {total} תוצאות | Showing {n} of {total} results |
| `tsUnlocked.fallbackPlayer` | שחקן | Player |
| `tsUnlocked.starBadge` | ⭐ כוכב | ⭐ Star |
| `tsUnlocked.confirmChange` | להחליף את הבחירה?\n\nמ: {from}\nל: {to} | Change your pick?\n\nFrom: {from}\nTo: {to} |
| `tsUnlocked.saveError` | שגיאה בשמירת הבחירה: {msg} | Failed to save pick: {msg} |
| `tsUnlocked.fallbackThePlayer` | השחקן | the player |
| `tsUnlocked.pickedToast` | 🥇 בחרת ב-{name}! | 🥇 You picked {name}! |
| `tsUnlocked.confirmClear` | לבטל את הבחירה של מלך השערים? | Clear top scorer pick? |
| `tsUnlocked.clearError` | שגיאה בביטול הבחירה | Failed to clear pick |
| `tsUnlocked.clearedToast` | הבחירה בוטלה | Pick cleared |

## Members list

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `membersList.title` | משתתפים | Members |
| `membersList.total` | בסה"כ | Total |
| `membersList.bet` | הימרו | Bet |
| `membersList.notYet` | עוד לא | Not yet |
| `membersList.partial` | הימר על {n} בחירות | Made {n} picks |
| `membersList.complete` | השלים את הבתים | Completed groups |
| `membersList.notStarted` | עדיין לא הימר | Not started yet |
| `membersList.allDone` | ✓ סיים את כל ההימור | ✓ Locked in — all picks made |
| `membersList.inProgress` | התחיל לבחור, עוד לא סיים | Started picking, not done yet |
| `membersList.noBets` | עוד לא הימר | Hasn\'t bet yet |
| `membersList.fallbackUser` | משתמש | User |
| `membersList.joinedToday` | הצטרף היום | Joined today |
| `membersList.joinedYesterday` | הצטרף אתמול | Joined yesterday |
| `membersList.joinedDaysAgo` | הצטרף לפני {n} ימים | Joined {n} days ago |
| `membersList.joinedOn` | הצטרף ב-{date} | Joined {date} |
| `membersList.loadError` | שגיאה בטעינת המשתתפים | Failed to load members |

## Recovery display

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `recoveryDisplay.title` | קוד השחזור שלך | Your recovery code |
| `recoveryDisplay.heroSubtitle` | הקוד הזה הוצג רק פעם אחת כשהצטרפת. מסיבות אבטחה לא ניתן להציג אותו שוב. | This code was shown only once when you joined. For security it cannot be shown again. |
| `recoveryDisplay.didntSave` | לא שמרת את הקוד? | Didn\'t save the code? |
| `recoveryDisplay.didntSaveText` | פנה למארגן ההימור ובקש לייצר עבורך קוד חדש. הקוד הקיים יישאר תקף - יש לך 2 קודים בו זמנית. | Ask the pool admin to generate a new code for you. The old one stays valid — you can have 2 codes at once. |
| `recoveryDisplay.whyTitle` | למה אני צריך קוד שחזור? | Why do I need a recovery code? |
| `recoveryDisplay.whyText` | קוד השחזור הוא הדרך היחידה להתחבר אם החלפת מכשיר, ניקית את הדפדפן, או רוצה להיכנס ממכשיר אחר. שמור אותו במקום בטוח! | The recovery code is the only way to log in if you change devices, clear your browser, or want to access from elsewhere. Keep it safe! |
| `recoveryDisplay.backBtn` | הבנתי, חזור לדשבורד | Got it, back to dashboard |
| `recoveryDisplay.copiedToast` | ✓ קוד השחזור הועתק | ✓ Recovery code copied |
| `recoveryDisplay.notFound` | לא נמצא קוד שחזור | No recovery code found |

## Help

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `helpEx.section1Title` | 📋 איך מהמרים? | 📋 How to bet |
| `helpEx.q1` | 1. הצטרפות להימור | 1. Joining a pool |
| `helpEx.a1` | לחץ "הצטרף להימור" בדף הבית, הזן קוד 5 תווים שקיבלת מהמארגן, בחר כינוי ושמור את קוד השחזור. | Tap "Join Pool" on the home page, enter the 5-letter code from your admin, choose a nickname and save the recovery code. |
| `helpEx.q2` | 2. הימור על שלב הבתים | 2. Group stage predictions |
| `helpEx.a2` | בכל בית (12 בתים) בחר 2 או 3 קבוצות שיעלו לשלב הבא. סך הכל צריך לבחור בדיוק 32 קבוצות. | In each of the 12 groups, pick 2 or 3 teams to advance. You must pick exactly 32 teams in total. |
| `helpEx.q3` | 3. ניקוד | 3. Scoring |
| `helpEx.a3` | תקבל נקודה (או יותר עם מכפילים) על כל קבוצה שניחשת נכון שתעלה לשלב הבא. | You earn a point (more with multipliers) for each correct prediction that advances. |
| `helpEx.section2Title` | 🎲 מכפילי סיכון | 🎲 Risk multipliers |
| `helpEx.q4` | ⭐ פייבוריטית - ×1 | ⭐ Favorite — ×1 |
| `helpEx.tierFav` | פייבוריטית | Favorite |
| `helpEx.tierCont` | מתמודדת | Contender |
| `helpEx.tierUnd` | אנדרדוג | Underdog |
| `helpEx.a4` | קבוצות חזקות. ניחוש "בטוח" אבל נקודה אחת בלבד. | Strong teams. Safe pick, one point only. |
| `helpEx.q5` | ⚔️ מתמודדת - ×1.5 | ⚔️ Contender — ×1.5 |
| `helpEx.a5` | קבוצות באמצע הדירוג. סיכון בינוני, פרס בינוני. | Mid-tier teams. Medium risk, medium reward. |
| `helpEx.q6` | 🐶 אנדרדוג - ×2 | 🐶 Underdog — ×2 |
| `helpEx.a6` | קבוצות חלשות. סיכון גבוה אבל נקודה כפולה אם צדקת! | Weak teams. High risk, double points if you\'re right! |
| `helpEx.section3Title` | 🔐 אבטחה ופרטיות | 🔐 Security & Privacy |
| `helpEx.q7` | איבדתי את קוד השחזור | I lost my recovery code |
| `helpEx.a7` | פנה למארגן ההימור - רק הוא יכול לייצר עבורך קוד חדש. אנחנו לא שומרים את הקוד שלך בשרת מסיבות אבטחה. | Contact the pool admin — only they can generate a new code for you. We don\'t store your code on the server for security. |
| `helpEx.q8` | אילו פרטים אישיים נשמרים? | What personal data is saved? |
| `helpEx.a8` | רק הכינוי שבחרת וההימורים שלך. אין דרישה לאימייל, טלפון או פרטים אישיים אחרים. | Only the nickname you chose and your picks. No email, phone, or other personal info required. |
| `helpEx.q9` | מה קורה אחרי הטורניר? | What happens after the tournament? |
| `helpEx.a9` | 30 ימים אחרי סיום המונדיאל, כל הנתונים נמחקים אוטומטית מהמערכת. | 30 days after the World Cup ends, all data is automatically deleted from the system. |
| `helpEx.section4Title` | 💰 כסף ותשלומים | 💰 Money & Payments |
| `helpEx.q10` | איך עובדים התשלומים? | How do payments work? |
| `helpEx.a10` | FriendlyBet לא מטפלת בכסף בכלל! כל המעורבות הכספית מתבצעת מחוץ לאפליקציה - בקבוצות וואטסאפ או טלגרם של ההימור. | FriendlyBet doesn\'t handle money at all! Any financial side happens outside the app — in your group\'s WhatsApp or Telegram. |
| `helpEx.footer` | יש לך שאלה נוספת? פנה למארגן ההימור שלך. | More questions? Contact your pool admin. |

## Status modal

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `statusModal.almostTitle` | כמעט סיימת! | Almost done! |
| `statusModal.missingPicks` | חסר{plural} עוד {n} עול{pluralN} | {n} more pick{plural} to go |
| `statusModal.doneTitle` | מצוין! 🎉 | Excellent! 🎉 |
| `statusModal.doneSubtitle` | בחרת את כל ה-32 העולות | You picked all 32 advancing teams |
| `statusModal.picked` | בחרת | Picked |
| `statusModal.of` | מתוך | of |
| `statusModal.missing` | חסר | Missing |
| `statusModal.canAddTitle` | בתים שאפשר להוסיף בהם עולה שלישית: | Groups where you can add a 3rd pick: |
| `statusModal.noGroupsToAdd` | לא נמצאו בתים עם 2 עולות.<br/>תוכל להוסיף בכל בית. | No groups with 2 picks found.<br/>You can add in any group. |
| `statusModal.expandable` | {n} בתים עם 2 עולות - לחץ כדי להוסיף שלישית: | {n} groups with 2 picks — tap to add a third: |
| `statusModal.closeBtn` | סגור והמשך בעצמי | Close and continue |

## Generic / app.js toasts

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `errors.loadError` | שגיאה בטעינה | Failed to load |
| `errors.unexpected` | שגיאה לא צפויה | Unexpected error |
| `errors.unexpectedMsg` | שגיאה לא צפויה: {msg} | Unexpected error: {msg} |
| `errors.missingData` | שגיאה - חסרים נתונים | Error — missing data |
| `errors.reconnect` | שגיאה - אנא התחבר מחדש | Error — please log in again |
| `errors.tryAgain` | שגיאה - אנא נסה שוב | Error — please try again |
| `errors.serverConnecting` | מתחבר לשרת... נסה שוב בעוד רגע | Connecting to server... try again in a moment |
| `errors.serverConnectingShort` | מתחבר לשרת... | Connecting to server... |
| `errors.serverConnectingRetry` | מתחבר לשרת... נסה שוב | Connecting to server... try again |
| `errors.searchingPool` | מחפש את ההימור... | Searching for pool... |
| `errors.poolSearchError` | שגיאה בחיפוש ההימור. נסה שוב. | Pool search failed. Try again. |
| `errors.poolNotFoundCode` | לא נמצא הימור עם הקוד {code} | No pool found with code {code} |
| `errors.poolLockedNoJoin` | 🔒 ההימור הזה נעול ולא מקבל חברים חדשים | 🔒 This pool is locked and not accepting new members |
| `errors.joinCodeRequired` | נא להזין קוד הימור | Please enter a pool code |
| `errors.joinCodeLen` | קוד הימור הוא 5 תווים | Pool code is 5 characters |
| `errors.creatingUser` | יוצר משתמש... | Creating user... |
| `errors.creatingUserFail` | שגיאה ביצירת המשתמש: {msg} | Failed to create user: {msg} |
| `errors.creatingPool` | יוצר את ההימור... | Creating pool... |
| `errors.uniqueCodeFail` | שגיאה ביצירת קוד ייחודי | Failed to generate unique code |
| `errors.creatingPoolFail` | שגיאה ביצירת ההימור: {msg} | Failed to create pool: {msg} |
| `errors.creatingAdminFail` | שגיאה ביצירת מנהל ההימור: {msg} | Failed to create admin: {msg} |
| `errors.poolCreated` | ההימור נוצר בהצלחה! 🎉 | Pool created successfully! 🎉 |
| `errors.alreadyMember` | אתה כבר חבר בהימור.\n\nכדי להצטרף להימור חדש, תצטרך לצאת מהקיים.\n\nלצאת ולהצטרף להימור החדש? | You\'re already in a pool.\n\nTo join a new pool, you must leave the current one.\n\nLeave and join the new pool? |

## v2.0.0 - Wizard

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `wizard.title` | הגדרת ההימור | Pool Setup |
| `wizard.stepLabel` | שלב {n} מתוך {total} | Step {n} of {total} |
| `wizard.continueToSetup` | המשך להגדרת ההימור | Continue to setup |
| `wizard.next` | הבא | Next |
| `wizard.back` | חזור | Back |
| `wizard.createPool` | צור הימור | Create Pool |
| `wizard.recommended` | מומלץ ⭐ | Recommended ⭐ |
| `wizard.advanced` | מתקדם | Advanced |
| `wizard.step1.title` | בחר את שיטת ההימור | Choose Betting Mode |
| `wizard.step1.subtitle` | איך השחקנים שלך יהמרו? | How will your players place their bets? |
| `wizard.step1.singlePhase.title` | הימור חד-פעמי | Single Phase Betting |
| `wizard.step1.singlePhase.description` | השחקנים מהמרים פעם אחת לפני תחילת המונדיאל. הם מנחשים הכל: מיקום בבתים, שלב הנוקאאוט המלא, מנצחת הטורניר, ומלך השערים. | Players bet ONCE before the tournament starts. They predict everything: group positions, full bracket, tournament winner, and top scorer. |
| `wizard.step1.twoPhase.title` | הימור דו-שלבי | Two-Phase Betting |
| `wizard.step1.twoPhase.description` | השחקנים מהמרים פעמיים: פעם לפני הבתים (רק על הקבוצות שיעלו מהבית), ופעם נוספת אחרי הבתים על שלב הנוקאאוט ומלך השערים. יותר ריאלי, אבל דורש כניסה להימור בשני זמנים שונים. | Players bet TWICE: once before the groups (only group qualifiers), then again after the groups for knockout + top scorer. More realistic, but requires betting at two separate times. |
| `wizard.step2.title` | חוקי הניקוד | Scoring Rules |
| `wizard.step2.subtitle` | איך מחושבות נקודות? | How are points calculated? |
| `wizard.step2.useDefaults` | שימוש בחוקים המומלצים | Use Recommended Rules |
| `wizard.step2.useDefaults.desc` | הגדרות מאוזנות שמתאימות לרוב הקבוצות. | Balanced settings that work for most groups. |
| `wizard.step2.customize` | התאמה אישית של החוקים | Customize Rules |
| `wizard.step2.customize.desc` | קבע בעצמך את הניקוד לכל שלב. | Set the points for each stage yourself. |
| `wizard.step3.title` | סיכום ויצירה | Review & Create |
| `wizard.step3.subtitle` | בדוק את ההגדרות לפני יצירת ההימור | Check the settings before creating the pool |
| `wizard.summary.poolName` | שם ההימור | Pool name |
| `wizard.summary.admin` | המארגן | Admin |
| `wizard.summary.mode` | שיטת הימור | Betting mode |
| `wizard.summary.totalPoints` | סך נקודות מקסימלי | Max total points |
| `wizard.summary.rules` | חוקי הניקוד | Scoring rules |
| `wizard.rule.group_first` | מקום ראשון בבית | Group 1st place |
| `wizard.rule.group_second` | מקום שני בבית | Group 2nd place |
| `wizard.rule.group_third` | מקום שלישי בבית | Group 3rd place |
| `wizard.rule.group_fourth` | מקום רביעי בבית | Group 4th place |
| `wizard.rule.round_of_32` | סבב 32 | Round of 32 |
| `wizard.rule.round_of_16` | שמינית גמר | Round of 16 |
| `wizard.rule.quarter_final` | רבע גמר | Quarter Final |
| `wizard.rule.semi_final` | חצי גמר | Semi Final |
| `wizard.rule.final` | גמר | Final |
| `wizard.rule.tournament_winner` | מנצחת הטורניר | Tournament Winner |
| `wizard.rule.top_scorer` | מלך השערים | Top Scorer |
| `wizard.ruleGroup.group` | שלב הבתים | Group stage |
| `wizard.ruleGroup.knockout` | נוקאאוט | Knockout |
| `wizard.ruleGroup.bonus` | בונוסים | Bonus |
| `wizard.ruleGroup.winner` | מנצחת הטורניר | Tournament winner |
| `wizard.rule.advancing_team` | כל קבוצה שעולה מהבית | Each advancing team |
| `wizard.multipliers.explainTitle` | איך זה עובד | How it works |
| `wizard.multipliers.explain` | כל קבוצה מסווגת לאחד משלושה דירוגים לפי דירוג FIFA. הימור על קבוצה חלשה יותר שמתממש מזכה אותך ביותר נקודות: פייבוריטית ×1, מתמודדת ×1.5, אנדרדוג ×2. המכפיל מוחל על הנקודות שמרוויחים על הקבוצה הזו בלבד. | Every team is rated in one of three tiers based on FIFA ranking. Correctly betting on a weaker team scores you more: Favorite ×1, Contender ×1.5, Underdog ×2. The multiplier applies only to points earned from that specific team. |
| `wizard.multipliers.singlePhaseNote` | בהימור חד-שלבי המכפילים משפיעים רק משלב הנוקאאוט. ניחושי הבתים שווים נקודה אחת לכל קבוצה. | In single-phase pools, multipliers apply only from the knockout stage onward. Group-position picks award one flat point per team. |
| `wizard.multipliers.powerOn` | מכפילים מופעלים | Multipliers on |
| `wizard.multipliers.powerOff` | מכפילים כבויים | Multipliers off |
| `wizard.multipliers.optional` | אופציונלי | Optional |
| `wizard.multipliers.perTeamTitle` | מכפיל סיכון פר-קבוצה (אופציונלי) | Per-team multiplier (optional) |
| `wizard.multipliers.perTeamHelp` | אפשר להגדיר ידנית מכפיל לקבוצה מסוימת. ערכים שלא נגעת בהם נשארים על מכפיל הקטגוריה. | Override the multiplier for a specific team. Untouched teams stay on the category multiplier. |
| `wizard.multipliers.perTeamReset` | איפוס לכל הקבוצות | Reset all teams |

## v2.0.0 - Single-phase betting

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `betting.singlePhase.title` | הימור חד-פעמי | Single Phase Betting |
| `betting.groupPositions.title` | מיקום בבתים | Group Positions |
| `betting.groupPositions.instructions` | הקבוצות מסודרות לפי דירוג FIFA. גרור כדי לשנות את הסדר. | Teams are pre-sorted by FIFA ranking. Drag to reorder them. |
| `betting.groupPositions.scoringNote` | נקודה על כל מיקום שניחשת נכון בסיום שלב הבתים, בלי קשר לקבוצות שעלו. | 1 point for each position you correctly predict at the end of the group stage — regardless of which teams advance. |
| `betting.groupStep` | בית {n} מתוך {total} | Group {n} of {total} |
| `betting.position.1` | מקום ראשון | First place |
| `betting.position.2` | מקום שני | Second place |
| `betting.position.3` | מקום שלישי | Third place |
| `betting.position.4` | מקום רביעי | Fourth place |
| `betting.groupFull` | הבית מלא. הסר קבוצה כדי להחליף. | Group is full. Remove a team to replace. |
| `betting.groupsIncomplete` | חסרות תוצאות בבתים: {letters} | Missing predictions for groups: {letters} |
| `betting.groupsIncompleteHint` | התקדמת עם בתים חסרים: {letters}. תמיד אפשר לחזור ולהשלים. | Moved on with incomplete groups: {letters}. You can always come back. |
| `betting.finalMissingHint` | התקדמת בלי לבחור את מנצחת הגמר. תמיד אפשר לחזור. | Moved on without picking the final winner. You can always come back. |
| `betting.partialSaveHint` | ✓ ההימור נשמר. עוד נשאר: {details} | ✓ Picks saved. Still left: {details} |
| `betting.continueToBracket` | המשך לברקאט | Continue to bracket |
| `betting.skipForNow` | דלג בינתיים — נחזור לזה אחר כך | Skip for now — I\'ll come back |
| `betting.bracket.title` | שלב הנוקאאוט שלך | Your Bracket |
| `betting.bracket.instructions` | שלב הנוקאאוט נוצר מתוצאות הבתים שלך. בכל משחק - בחר את המנצח. | Your bracket is built from your group predictions. For each match - pick the winner. |
| `betting.tournamentWinner.title` | מנצחת הטורניר | Tournament Winner |
| `betting.tournamentWinner.question` | מי תזכה במונדיאל? | Who wins the World Cup? |
| `betting.tournamentWinner.subtitle` | בחר את הקבוצה שלדעתך תרים את הגביע | Pick the team you think will lift the trophy |
| `betting.winnerRequired` | בחר את מנצחת הטורניר | Please pick a tournament winner |
| `betting.finalRequired` | בחר את המנצחת של משחק הגמר לפני שתמשיך | Pick the final match winner before you continue |
| `betting.summary.title` | סיכום הניחושים | Predictions Summary |
| `betting.summary.warning` | תוכל לערוך את הניחושים כל עוד המונדיאל לא התחיל. ברגע שמשחק ראשון מתחיל - הניחושים יינעלו. | You can edit your predictions any time before the tournament starts. Once the first match begins, they lock automatically. |
| `betting.summary.groups` | תוצאות הבתים | Group Predictions |
| `betting.summary.bracket` | ברקאט | Bracket |
| `betting.summary.winner` | מנצחת הטורניר | Tournament Winner |
| `betting.summary.topScorer` | מלך השערים | Top Scorer |
| `betting.summary.submit` | שמור את הניחושים שלי | Save my predictions |
| `betting.saved` | הניחושים נשמרו! 🎯 | Predictions saved! 🎯 |
| `betting.continueToSummary` | המשך לסיכום | Continue to summary |
| `betting.summary.editTopScorer` | ערוך מלך שערים | Edit top scorer |
| `betting.summary.editPicks` | ערוך קבוצות וברקאט | Edit groups & bracket |
| `betting.notPicked` | לא נבחר | Not picked |
| `betting.confirmSubmit` | ⚠️ לשלוח את הניחושים הסופיים?\n\nאחרי שליחה ותחילת הטורניר - לא ניתן יהיה לשנות! | ⚠️ Submit your final predictions?\n\nOnce submitted and the tournament starts, you cannot change them! |
| `betting.submitted` | הניחושים נשלחו בהצלחה! 🎉 | Predictions submitted! 🎉 |
| `betting.locked.title` | הניחושים שלך | Your Predictions |
| `betting.locked.heading` | הניחושים נשלחו ונעולים | Predictions submitted and locked |
| `betting.locked.message` | לא ניתן לשנות יותר. צפה בניחושים שלך למטה. | No more changes allowed. View your predictions below. |

## v2.0.0 - Leaderboard breakdown

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `leaderboard.viewBracket` | צפה בניחושי הנוקאאוט | View knockout picks |
| `leaderboard.bracketOfTitle` | ניחושי הנוקאאוט של {name} | Knockout picks · {name} |
| `leaderboard.breakdown.group` | בתים | Groups |
| `leaderboard.breakdown.knockout` | נוקאאוט | Knockout |
| `leaderboard.breakdown.bonus` | בונוס | Bonus |
| `leaderboard.noPicks` | אין ניחושים להצגה | No predictions to show |

## v2.1.4 - Dashboard reflow

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `dashboard.preTournament.title` | המונדיאל עוד לא התחיל | Tournament hasn\'t started yet |
| `dashboard.preTournament.subtitle` | הדירוג יופיע כאן כשהמשחקים יתחילו | Your rank will appear here once matches begin |
| `dashboard.progress.notStarted.title` | מוכן להמר? 🎯 | Ready to play? 🎯 |
| `dashboard.progress.notStarted.subtitle` | בחר את הקבוצות שלך וצא לדרך — לוקח רק כמה דקות | Pick your teams and lock it in — takes just a few minutes |
| `dashboard.progress.adminInviteFirst.title` | מוכן להמר? 🎯 | Ready to play? 🎯 |
| `dashboard.progress.adminInviteFirst.subtitle` | קודם כל הזמן חברים, ואחר כך תתחיל להמר בעצמך — לוקח רק כמה דקות | First invite your friends, then make your own picks — takes just a few minutes |
| `dashboard.progress.partial.title` | אתה בעיצומו 💪 | You\'re cooking 💪 |
| `dashboard.progress.partial.subtitle` | עוד כמה בחירות ואתה גמרת | A few more picks and you\'re done |
| `dashboard.progress.allSet.title` | סגרת הכל! 🎉 | ALL SET! 🎉 |
| `dashboard.progress.allSet.subtitle` | ההימור שלך בפנים. עוד אפשר לערוך עד שריקת הפתיחה של המונדיאל | Your picks are in. Still tweakable right up to the opening whistle |
| `dashboard.startCta.title` | התחל להמר על המונדיאל | Start predicting the World Cup |
| `dashboard.startCta.subtitle` | בחר את הקבוצות שלך לכל בית | Pick your teams for each group |
| `dashboard.continueCta.title` | המשך את ההימור | Continue your predictions |
| `dashboard.continueCta.partialGroups` | השלמת {n} מתוך {total} בתים | {n} of {total} groups done |
| `dashboard.continueCta.almostDone` | עוד צעד אחד - ברקאט ומלך השערים | One more step - bracket and top scorer |
| `dashboard.editCta.title` | ערוך את ההימור שלך | Edit your predictions |
| `dashboard.viewCta.title` | צפה בניחושים שלך | View your predictions |
| `dashboard.viewCta.subtitle` | עדכן או ערוך עד שהמונדיאל מתחיל | Update or edit until the tournament starts |

## v2.1.0 - Recovery code screen

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `recovery.poolCreated.title` | ההימור נוצר! | Pool Created! |
| `recovery.poolCreated.subtitle` | ברוך הבא להימור שלך! | Welcome to your pool! |
| `recovery.joined.title` | הצטרפת! | You\'re In! |
| `recovery.joined.subtitle` | בוא נתחיל לנחש! | Get ready to predict! |
| `recovery.codeLabel` | קוד השחזור האישי שלך | Your Personal Recovery Code |
| `recovery.warning.title` | שמור את הקוד! | Save this code! |
| `recovery.warning.text` | תצטרך אותו כדי להתחבר ממכשיר אחר או אם המכשיר הנוכחי יתנתק. | You\'ll need it to access your account from another device or if this one is disconnected. |
| `recovery.privacy` | שמור על פרטיות. אל תשתף. | Keep it private. Don\'t share. |
| `recovery.adminHelp.title` | איבדת את הקוד? אין בעיה. | Lost the code? No worries. |
| `recovery.adminHelp.text` | תמיד אפשר לבקש מהאדמין של ההימור שישלח לך קוד שחזור חדש בוואטסאפ או בטלגרם. | You can always ask the pool admin to send you a fresh recovery link on WhatsApp or Telegram. |
| `recovery.button.copy` | העתק | Copy |
| `recovery.button.email` | שלח במייל | Email yourself |
| `recovery.button.download` | הורד כקובץ | Download Text File |
| `recovery.button.copied` | ✓ הועתק! | ✓ Copied! |
| `recovery.toast.copied` | ✓ הועתק ללוח! | ✓ Copied to clipboard! |
| `recovery.toast.downloaded` | ✓ הקובץ הורד! | ✓ File downloaded! |
| `recovery.button.continue` | המשך להימור | Continue to Pool |
| `recovery.button.close` | סגור | Close |
| `recovery.warningModal.title` | שמרת את הקוד? | Did you save the code? |
| `recovery.warningModal.text` | תצטרך את הקוד כדי להתחבר ממכשיר אחר, או מהמכשיר הזה אם תתנתק. בלי הקוד — אין דרך לחזור לחשבון. | You\'ll need this code to log in from another device, or from this device if you sign out. Without it, there\'s no way back into your account. |
| `recovery.warningModal.saveCode` | שמור את הקוד | Save Code |
| `recovery.warningModal.continueAnyway` | המשך בכל מקרה | Continue Anyway |
| `recovery.warningModal.notYet` | עדיין לא, חזור לשמור | Not yet, go back to save |
| `recovery.warningModal.yesSaved` | כן, המשך להימור | Yes, continue to pool |
| `recovery.menu.viewCode` | קוד השחזור שלי | My Recovery Code |
| `recovery.viewMode.title` | קוד השחזור שלך | Your Recovery Code |
| `recovery.email.subject` | קוד שחזור FriendlyBet | FriendlyBet Recovery Code |
| `recovery.email.body` | שלום! 👋\n\nזה קוד השחזור האישי שלך ל-FriendlyBet.\nשמור אותו במקום בטוח - תצטרך אותו כדי להתחבר.\n\nקוד שחזור: {code}\n\nהימור: {poolName}\nהיכנס דרך: https://friendlybet.live\n\n⚠️ שמור על פרטיות! אל תשתף עם אחרים. | Hi! 👋\n\nThis is your personal FriendlyBet recovery code.\nKeep it safe - you\'ll need it to access your account.\n\nRecovery Code: {code}\n\nPool: {poolName}\nLogin at: https://friendlybet.live\n\n⚠️ Keep this private! Don\'t share with anyone. |
| `recovery.txt.header` | קוד שחזור FriendlyBet | FriendlyBet Recovery Code |
| `recovery.txt.codeLabel` | קוד השחזור האישי שלך: | Your personal recovery code: |
| `recovery.txt.poolLabel` | הימור: | Pool: |
| `recovery.txt.createdLabel` | נוצר: | Created: |
| `recovery.txt.important` | חשוב: | IMPORTANT: |
| `recovery.txt.warning1` | שמור על קוד זה בפרטיות | Keep this code private |
| `recovery.txt.warning2` | אל תשתף עם אף אחד | Don\'t share with anyone |
| `recovery.txt.warning3` | תצטרך אותו כדי להתחבר לחשבון שלך | You\'ll need it to access your account |
| `recovery.txt.loginAt` | היכנס דרך: | Login at: |

## v2.4 additions (Hebrew)

| מפתח (key) | עברית | אנגלית (לעיון) |
|---|---|---|
| `recovery.button.screenshot` | שמור כתמונה | Save as image |
| `recovery.button.email` | שלח לעצמי באימייל | Email yourself |
| `recovery.button.download` | הורד קובץ טקסט | Download Text File |
| `recovery.button.emailMe` | שלח את הקוד לאימייל שלי | Send the code to my email |
| `recovery.toast.screenshotDone` | ✓ סומן כצולם | ✓ Marked as captured |
| `recovery.toast.emailCopied` | ✓ תוכן המייל הועתק ללוח - הדבק במייל שלך | ✓ Email content copied to clipboard - paste into your email |
| `recovery.toast.emailOpened` | ✓ נפתח חלון מייל | ✓ Opened your email client |
| `shareModal.copy` | העתק | Copy |
| `recovery.toast.emailOpenedWithBackup` | ✓ נפתח חלון מייל - ונשמר גיבוי בלוח | ✓ Opened email - content also copied to clipboard as backup |
| `recovery.toast.popupBlocked` | הדפדפן חסם את הפתיחה. אנא אפשר חלונות קופצים ונסה שוב. | Your browser blocked the new window. Please allow popups and try again. |
| `recovery.screenshot.title` | שמור את הקוד כתמונה | Save your code as an image |
| `recovery.screenshot.intro` | יצרנו עבורך תמונה עם קוד השחזור. שמור אותה בגלריה או שתף לעצמך. | We generated an image with your recovery code. Save it to your gallery or share it to yourself. |
| `recovery.screenshot.codeLabel` | קוד השחזור שלך | Your recovery code |
| `recovery.screenshot.tip` | אחרי הצילום, בדוק בגלריה שהקוד יצא ברור וקריא. | After the screenshot, check the gallery to make sure the code is clear and readable. |
| `recovery.screenshot.done` | צילמתי, המשך | Captured, continue |
| `recovery.screenshot.generating` | מכין תמונה... | Generating image... |
| `recovery.screenshot.save` | שמור תמונה למכשיר | Save image to device |
| `recovery.screenshot.ios1` | לחץ בו-זמנית על {k1} + {k2} | Press {k1} + {k2} at the same time |
| `recovery.screenshot.ios2` | התמונה תיווצר ותופיע לזמן קצר בתחתית המסך | A thumbnail will briefly appear at the bottom of the screen |
| `recovery.screenshot.ios3` | הצילום יישמר אוטומטית באפליקציית התמונות | The screenshot is saved automatically to the Photos app |
| `recovery.screenshot.android1` | לחץ בו-זמנית על {k1} + {k2} למשך ~1 שנייה | Press and hold {k1} + {k2} together for ~1 second |
| `recovery.screenshot.samsung1` | לחץ בו-זמנית על {k1} + {k2} (או החלק עם כף היד על המסך) | Press {k1} + {k2} together (or swipe with your palm across the screen) |
| `recovery.screenshot.android2` | תוצג תצוגה מקדימה של הצילום | A preview of the screenshot will appear |
| `recovery.screenshot.android3` | הצילום יישמר אוטומטית בגלריה | The screenshot is saved to your gallery automatically |
| `recovery.screenshot.mac1` | לחץ {k1} + {k2} + {k3} ובחר את אזור הקוד | Press {k1} + {k2} + {k3} then drag over the code |
| `recovery.screenshot.mac2` | הצילום יישמר בשולחן העבודה | The screenshot is saved to your Desktop |
| `recovery.screenshot.win1` | לחץ {k1} + {k2} + {k3} ובחר את אזור הקוד | Press {k1} + {k2} + {k3} then drag over the code |
| `recovery.screenshot.win2` | הצילום יועתק ללוח / יישמר בתיקיית "צילומי מסך" | The screenshot is copied to clipboard / saved in Screenshots folder |
| `recovery.screenshot.generic1` | השתמש בפונקציית צילום המסך של המכשיר שלך | Use your device\'s built-in screenshot function |
| `recovery.screenshot.generic2` | התמונה תישמר אוטומטית בגלריה / שולחן העבודה | The image will be saved to your gallery / desktop automatically |
| `exitApp.title` | לצאת מהאפליקציה? | Exit the app? |
| `exitApp.text` | תוכל לחזור בכל זמן וההימור שלך נשמר אוטומטית. | You can come back any time - your predictions are saved automatically. |
| `exitApp.stay` | הישאר באפליקציה | Stay in app |
| `exitApp.confirm` | צא | Exit |
| `knockoutFirst.instructions` | בחר את הקבוצה שלדעתך תעלה לסבב הבא | Pick the team you think will advance to the next round |
| `knockoutFirst.pointsLabel` | {n} נקודות עבור הימור מדוייק | {n} points if you\'re right |
| `knockoutFirst.pointsLabelRange` | {min} או {max} נקודות עבור הימור מדוייק (לפי מכפיל הסיכון של הקבוצה) | {min} or {max} points if you\'re right (depending on the team\'s risk multiplier) |
| `knockoutFirst.winnerBonus` | + {n} נקודות בונוס על ניחוש מנצחת הטורניר | + {n} bonus points for picking the tournament champion |
| `knockoutFirst.skip` | דלג בינתיים | Skip for now |
| `knockoutFirst.completedToast` | מעולה! עכשיו תוכל לערוך כל בחירה | Great! You can now edit any pick |
| `groups.lockedTournamentStarted` | הטורניר התחיל - לא ניתן יותר לשנות את ההימור | Tournament started - predictions can no longer be edited |
