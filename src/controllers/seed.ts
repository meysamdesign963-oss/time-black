/**
 * Seed script — populates the DB with realistic Persian sample data.
 * Run with: `bun run src/controllers/seed.ts`
 *
 * Creates:
 *  - 1 BOSS user (admin) + 9 regular users with Persian names
 *  - Tasks per user (study, work, exercise, reading, etc.)
 *  - Time entries distributed across the current Jalali month
 *  - Public posts with Persian content
 *  - Some notifications + follows
 */
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { toJalaali, jalaaliToDateObject } from "jalaali-js";

const USERS = [
  { username: "admin", displayName: "مدیر ارشد", phone: "09120000001", password: "Admin@1234" },
  { username: "sina_dev", displayName: "سینا رضایی", phone: "09121111001", password: "User@1234" },
  { username: "mahsa_k", displayName: "مها کریمی", phone: "09121111002", password: "User@1234" },
  { username: "amir_h", displayName: "امیر حسینی", phone: "09121111003", password: "User@1234" },
  { username: "niloofar_z", displayName: "نیلوفر زارعی", phone: "09121111004", password: "User@1234" },
  { username: "reza_m", displayName: "رضا مرادی", phone: "09121111005", password: "User@1234" },
  { username: "sara_t", displayName: "سارا طاهری", phone: "09121111006", password: "User@1234" },
  { username: "koorosha", displayName: "کورش نوری", phone: "09121111007", password: "User@1234" },
  { username: "darya_f", displayName: "دریا فرهادی", phone: "09121111008", password: "User@1234" },
  { username: "bahram_a", displayName: "بهرام احمدی", phone: "09121111009", password: "User@1234" },
];

const TASK_TEMPLATES = [
  { title: "مطالعه کتاب برنامه‌نویسی", color: "#e0cba8", targetSeconds: 2 * 3600 },
  { title: "تمرین الگوریتم", color: "#8fbc8f", targetSeconds: 90 * 60 },
  { title: "ورزش صبحگاهی", color: "#c97064", targetSeconds: 45 * 60 },
  { title: "یادگیری زبان انگلیسی", color: "#a78bfa", targetSeconds: 60 * 60 },
  { title: "کار روی پروژه شخصی", color: "#7dd3fc", targetSeconds: 3 * 3600 },
  { title: "خواندن مقاله علمی", color: "#e0cba8", targetSeconds: 30 * 60 },
];

const POST_CONTENTS = [
  "امروز ۳ ساعت روی پروژه‌ام کار کردم و یک قدم به هدفم نزدیک‌تر شدم. تمرکز واقعی معجزه می‌کند!",
  "روز خوبی بود. مطالعه کتاب الگوریتم‌ها رو ادامه دادم. حس یادگیری چیزهای جدید فوق‌العاده‌ست.",
  "یاد گرفتم که پیشرفت کوچک ولی روزانه، خیلی بهتر از تلاش‌های بزرگ ولی نادر است.",
  "تمرین ورزش صبحگاهی‌ام رو یه هفته‌ایه رها نکردم. انرژی کل روزم تغییر کرده.",
  "به نظرم مهم‌ترین مهارت این روزها، مدیریت زمانه. این پلتفرم کمکم کرده خیلی نظم‌مندتر بشم.",
  "یه نکته جالب خوندم: مغز ما بعد از ۲۵ دقیقه تمرکز نیاز به استراحت داره. روش پومودرو واقعا جواب میده.",
];

const NOTIFICATIONS = [
  { type: "RANK_CHANGE", title: "تغییر رتبه", message: "رتبه شما در رقابت ماهانه ۲ پله صعود کرد!" },
  { type: "LIKE", title: "لایک جدید", message: "پست شما را یکی لایک کرد." },
  { type: "SYSTEM", title: "خوش آمدید", message: "به پلتفرم Time Black خوش آمدید!" },
  { type: "TASK", title: "یادآوری تسک", message: "تسک «مطالعه کتاب» هنوز فعال است." },
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("🌱 Seeding Time Black database...\n");

  // Wipe (safe in dev)
  await db.auditLog.deleteMany();
  await db.notification.deleteMany();
  await db.follow.deleteMany();
  await db.timeEntry.deleteMany();
  await db.task.deleteMany();
  await db.post.deleteMany();
  await db.session.deleteMany();
  await db.otpCode.deleteMany();
  await db.user.deleteMany();
  console.log("✓ Cleared existing data");

  const now = new Date();
  const j = toJalaali(now);
  const monthStart = jalaaliToDateObject(j.jy, j.jm, 1);

  // Create users
  const users = [];
  for (let i = 0; i < USERS.length; i++) {
    const u = USERS[i];
    const passwordHash = await bcrypt.hash(u.password, 12);
    const user = await db.user.create({
      data: {
        username: u.username,
        displayName: u.displayName,
        phone: u.phone,
        email: i === 0 ? "admin@timeblack.ir" : null,
        passwordHash,
        role: i === 0 ? "BOSS" : "USER",
        status: "ACTIVE",
        authMethod: "PASSWORD",
        bio:
          i === 0
            ? "بنیان‌گذار و مدیر ارشد پلتفرم Time Black"
            : `علاقه‌مند به ${randomFrom(["برنامه‌نویسی", "یادگیری مداوم", "بهره‌وری", "ورزش", "مطالعه"])}`,
        avatarUrl: null,
      },
    });
    users.push(user);
  }
  console.log(`✓ Created ${users.length} users (first = BOSS)`);

  // Create tasks + time entries for each user
  let totalEntries = 0;
  for (const user of users) {
    const taskCount = randomInt(3, 5);
    const userTasks = [];
    for (let t = 0; t < taskCount; t++) {
      const template = TASK_TEMPLATES[t % TASK_TEMPLATES.length];
      const task = await db.task.create({
        data: {
          userId: user.id,
          title: template.title,
          description: `هدف روزانه: ${Math.floor(template.targetSeconds / 3600)} ساعت`,
          targetSeconds: template.targetSeconds,
          status: randomFrom(["ACTIVE", "ACTIVE", "ACTIVE", "DONE"]),
          color: template.color,
          totalSeconds: 0,
        },
      });
      userTasks.push(task);
    }

    // Distribute 5-20 time entries across the month
    const entryCount = user.role === "BOSS" ? randomInt(8, 14) : randomInt(5, 18);
    let userTotal = 0;
    for (let e = 0; e < entryCount; e++) {
      const task = randomFrom(userTasks);
      const daysAgo = randomInt(0, Math.max(1, Math.floor((now.getTime() - monthStart.getTime()) / 86400000)));
      const startedAt = new Date(now);
      startedAt.setDate(startedAt.getDate() - daysAgo);
      startedAt.setHours(randomInt(7, 23), randomInt(0, 59), 0, 0);
      const durationSec = randomInt(15 * 60, 3 * 3600);
      const endedAt = new Date(startedAt.getTime() + durationSec * 1000);
      if (endedAt > now) continue;

      await db.timeEntry.create({
        data: {
          userId: user.id,
          taskId: task.id,
          startedAt,
          endedAt,
          durationSec,
          status: "COMPLETED",
        },
      });
      userTotal += durationSec;
      totalEntries++;
    }

    await db.user.update({
      where: { id: user.id },
      data: { totalSeconds: userTotal },
    });
  }
  console.log(`✓ Created tasks + ${totalEntries} time entries`);

  // Compute ranks
  const ranked = await db.user.findMany({
    orderBy: { totalSeconds: "desc" },
  });
  for (let i = 0; i < ranked.length; i++) {
    await db.user.update({
      where: { id: ranked[i].id },
      data: { currentRank: i + 1, prevRank: i + 1 + randomInt(-1, 1) },
    });
  }
  console.log("✓ Computed leaderboard ranks");

  // Create posts
  let postCount = 0;
  for (const user of users.slice(1)) {
    // skip boss
    const count = randomInt(1, 3);
    for (let p = 0; p < count; p++) {
      await db.post.create({
        data: {
          userId: user.id,
          content: randomFrom(POST_CONTENTS),
          visibility: "PUBLIC",
          status: "PUBLISHED",
          likeCount: randomInt(0, 45),
          commentCount: randomInt(0, 8),
          createdAt: new Date(now.getTime() - randomInt(1, 20) * 86400000),
        },
      });
      postCount++;
    }
  }
  console.log(`✓ Created ${postCount} public posts`);

  // Notifications for a few users
  for (const user of users.slice(0, 5)) {
    for (const n of NOTIFICATIONS) {
      await db.notification.create({
        data: {
          userId: user.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: Math.random() > 0.5,
          createdAt: new Date(now.getTime() - randomInt(1, 72) * 3600000),
        },
      });
    }
  }
  console.log("✓ Created sample notifications");

  // Some follows
  for (let i = 1; i < users.length; i++) {
    // everyone follows admin
    await db.follow.create({
      data: { followerId: users[i].id, followeeId: users[0].id },
    }).catch(() => {});
    // a few cross-follows
    const target = users[randomInt(1, users.length - 1)];
    if (target.id !== users[i].id) {
      await db.follow.create({
        data: { followerId: users[i].id, followeeId: target.id },
      }).catch(() => {});
    }
  }
  console.log("✓ Created follow relationships");

  // Audit log entries
  await db.auditLog.createMany({
    data: [
      { userId: users[0].id, action: "LOGIN", ip: "127.0.0.1", createdAt: now },
      { userId: users[1].id, action: "LOGIN", ip: "127.0.0.1", createdAt: now },
      { userId: users[0].id, action: "DELETE_TASK", ip: "127.0.0.1", createdAt: now },
    ],
  });
  console.log("✓ Created audit logs");

  console.log("\n🎉 Seed complete!");
  console.log("   Boss login:  username=admin  password=Admin@1234");
  console.log("   User login:  username=sina_dev  password=User@1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
