import crypto from "crypto";

const PREFIX = "scrypt$";

export const isHashed = (v: any) => typeof v === "string" && v.startsWith(PREFIX);

export const hashPassword = (plain: string): string => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(plain), salt, 64).toString("hex");
  return `${PREFIX}${salt}$${hash}`;
};

/** Checks a login password; old plain-text values still match so nobody is locked out. */
export const verifyPassword = (stored: any, given: any): boolean => {
  if (stored == null || given == null || given === "") return false;
  if (!isHashed(stored)) return String(stored) === String(given);
  const [, salt, hash] = String(stored).split("$");
  const test = crypto.scryptSync(String(given), salt, 64);
  const want = Buffer.from(hash, "hex");
  return want.length === test.length && crypto.timingSafeEqual(want, test);
};

/** After a good login on a plain-text value, store it hashed. */
export const upgradePassword = async (model: any, id: any, stored: any, given: string) => {
  if (isHashed(stored)) return;
  try { await model.updateOne({ _id: id }, { $set: { password: given } }); } catch { /* next login retries */ }
};

const hashIn = (obj: any) => {
  if (obj && typeof obj.password === "string" && obj.password !== "" && !isHashed(obj.password)) {
    obj.password = hashPassword(obj.password);
  }
};

/** Mongoose plugin: every write path stores the password hashed. */
export const hashPasswordPlugin = (schema: any) => {
  schema.pre("save", function (this: any, next: any) {
    if (this.isModified("password")) hashIn(this);
    next();
  });
  schema.pre("insertMany", function (next: any, docs: any) {
    (Array.isArray(docs) ? docs : [docs]).forEach(hashIn);
    next();
  });
  const onUpdate = function (this: any, next: any) {
    const u = this.getUpdate() || {};
    hashIn(u);
    hashIn(u.$set);
    hashIn(u.$setOnInsert);
    next();
  };
  ["findOneAndUpdate", "updateOne", "updateMany", "findOneAndReplace", "replaceOne"].forEach((op) => schema.pre(op, onUpdate));
};
