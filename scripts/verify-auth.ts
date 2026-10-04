import { prisma } from "../src/lib/prisma";
import { authenticate, registerAccount } from "../src/lib/auth";
import { hashPassword, verifyPassword } from "../src/lib/password";

async function main() {
  const stamp = Date.now().toString(36);
  const email = `auth-${stamp}@example.com`;
  const password = "motdepasse";
  const local = await prisma.user.create({ data: { displayName: "Collection locale" } });
  const roundtrip = await hashPassword(password);
  if (roundtrip.includes(password) || !(await verifyPassword(password, roundtrip))) {
    throw new Error("password hash");
  }
  if (await verifyPassword("autre-mot", roundtrip)) throw new Error("password mismatch accepted");

  try {
    const claimed = await registerAccount({
      email,
      password,
      displayName: "Compte",
      localUserId: local.id,
    });
    if (claimed.id === local.id) throw new Error("orphan must not be claimed on register");
    if (claimed.email !== email) throw new Error("email not stored");
    if (claimed.displayName !== "Compte") throw new Error("display name");
    if (!(await prisma.user.findUnique({ where: { id: local.id } }))) {
      throw new Error("orphan user deleted unexpectedly");
    }

    const duplicate = await registerAccount({
      email,
      password,
      displayName: null,
      localUserId: null,
    }).then(
      () => "created",
      (error: unknown) => (error instanceof Error ? error.message : "error"),
    );
    if (duplicate !== "EMAIL_TAKEN") throw new Error(`duplicate ${duplicate}`);

    const logged = await authenticate(email, password);
    if (logged?.id !== claimed.id) throw new Error("login");
    if (await authenticate(email, "mauvaisxx")) throw new Error("bad password accepted");
    if (await authenticate(`absent-${stamp}@example.com`, password)) throw new Error("unknown accepted");

    await prisma.session.deleteMany({ where: { userId: claimed.id } });
    await prisma.user.delete({ where: { id: claimed.id } }).catch(() => undefined);
  } finally {
    await prisma.session.deleteMany({ where: { userId: local.id } });
    await prisma.user.delete({ where: { id: local.id } }).catch(() => undefined);
  }

  console.log(JSON.stringify({ ok: true }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
