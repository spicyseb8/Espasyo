import { adminAuth, adminDb } from "./firebase-admin.js";

const TEMPORARY_PASSWORD = "Espasyo@123";

const customers = [
  {
    full_name: "Rafael Edward R. Brinosa",
    email: "sfmaster902@gmail.com",
    phone_number: "+633412309099",
    address: "",
  },
  {
    full_name: "Denise Lei Makilan",
    email: "deniselei@gmail.com",
    phone_number: "+63 9566871377",
    address: "Brgy. Sta Rosa, Alaminos, Laguna",
  },
  {
    full_name: "John Kurt Aldrin Viriña",
    email: "kulowtvirina@gmail.com",
    phone_number: "+63 9923635586",
    address: "Brgy. Yukos, Nagcarlan, Laguna",
  },
  {
    full_name: "Franz Dianne G. Abad",
    email: "abadfranzdianne@gmail.com",
    phone_number: "+63 9916800806",
    address: "Brgy. Anastacia, Tiaong, Quezon",
  },
  {
    full_name: "Curt Jerves Abril",
    email: "curtabril1206@gmail.com",
    phone_number: "+63 9397352144",
    address: "Brgy. Sta. Monica, San Pablo City",
  },
  {
    full_name: "Maria Chriswell Pili",
    email: "mchriswell24@gmail.com",
    phone_number: "+63 9763804356",
    address: "Brgy. Santo Angel, San Pablo City",
  },
  {
    full_name: "Ryle Ibanez",
    email: "ryleibanez@gmail.com",
    phone_number: "+63 7893561698",
    address: "Brgy. Yukos, Nagcarlan, Laguna",
  },
  {
    full_name: "Chaira De Mesa",
    email: "chairademesa@gmail.com",
    phone_number: "+63 9489875303",
    address: "Brgy. Sta Rosa, Alaminos, Laguna",
  },
];

const employees = [
  {
    name: "Einn Frankfort Lindo",
    email: "einnfrankfort@gmail.com",
  },
  {
    name: "Luisito Cervana",
    email: "luisito12@gmail.com",
  },
  {
    name: "Michelle Manzo",
    email: "mmanzo58@gmail.com",
  },
  {
    name: "Hazel Cervana",
    email: "cervanahzl12@gmail.com",
  },
  {
    name: "Jerome Ramos",
    email: "jerome_ramos11@gmail.com",
  },
  {
    name: "Vhin Andaya",
    email: "vhinandyaa@gmail.com",
  },
];

const avatar = (name) =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
    name
  )}`;

const now = new Date();

async function getOrCreateAuthUser({ email, displayName }) {
  try {
    const existingUser = await adminAuth.getUserByEmail(email);

    const updatedUser = await adminAuth.updateUser(existingUser.uid, {
      emailVerified: true,
      displayName,
    });

    console.log(`  Auth account verified: ${email}`);

    return updatedUser;
  } catch (error) {
    if (error.code !== "auth/user-not-found") {
      throw error;
    }

    const newUser = await adminAuth.createUser({
      email,
      password: TEMPORARY_PASSWORD,
      displayName,
      emailVerified: true,
    });

    console.log(`  Auth account created and verified: ${email}`);

    return newUser;
  }
}

async function seedCustomer(customer) {
  const authUser = await getOrCreateAuthUser({
    email: customer.email,
    displayName: customer.full_name,
  });

  const userRef = adminDb.collection("users").doc(authUser.uid);
  const existingDoc = await userRef.get();

  const data = {
    id: authUser.uid,
    full_name: customer.full_name,
    email: customer.email,
    phone_number: customer.phone_number,
    address: customer.address,
    avatar: avatar(customer.full_name),
    updated_at: now,
  };

  if (!existingDoc.exists) {
    data.created_at = now;
  }

  await userRef.set(data, { merge: true });

  console.log(
    `  Firestore profile created/updated: ${customer.full_name}`
  );
  console.log(`  UID: ${authUser.uid}`);

  return authUser;
}

async function seedEmployee(employee) {
  const authUser = await getOrCreateAuthUser({
    email: employee.email,
    displayName: employee.name,
  });

  const employeeRef = adminDb
    .collection("adminEmployees")
    .doc(authUser.uid);

  const existingDoc = await employeeRef.get();

  const data = {
    id: authUser.uid,
    name: employee.name,
    email: employee.email,
    role: "admin",
    avatar: avatar(employee.name),
    updated_at: now,
  };

  if (!existingDoc.exists) {
    data.created_at = now;
  }

  await employeeRef.set(data, { merge: true });

  console.log(
    `  Firestore employee created/updated: ${employee.name}`
  );
  console.log(`  UID: ${authUser.uid}`);

  return authUser;
}

async function seedProject(customer) {
  const customerUser = await adminAuth.getUserByEmail(customer.email);

  const projectRef = adminDb
    .collection("projects")
    .doc("project-test-001");

  const projectData = {
    id: "project-test-001",
    user_id: customerUser.uid,
    name: "Modern Living Room",
    description:
      "A sample interior design project for testing the Espasyo dashboard.",
    project_data: {
      version: 1,
      rooms: [],
      walls: [],
      furniture: [],
    },
    status: "draft",
    created_at: now,
    updated_at: now,
  };

  await projectRef.set(projectData, { merge: true });

  console.log("  Project created/updated.");
  console.log("  Project ID: project-test-001");
  console.log(`  Owner: ${customer.full_name}`);
  console.log(`  Owner UID: ${customerUser.uid}`);
}

async function main() {
  console.log("");
  console.log("======================================");
  console.log("Espasyo Test Data Seeder");
  console.log("======================================");
  console.log("");
  console.log("Temporary password:");
  console.log(TEMPORARY_PASSWORD);
  console.log("");

  console.log("Creating customers...");

  for (const customer of customers) {
    await seedCustomer(customer);
  }

  console.log("");
  console.log("Creating employees...");

  for (const employee of employees) {
    await seedEmployee(employee);
  }

  console.log("");
  console.log("Creating sample project...");

  await seedProject(customers[0]);

  console.log("");
  console.log("======================================");
  console.log("Seeding completed successfully.");
  console.log("======================================");
  console.log("");
  console.log("Created/updated:");
  console.log(`Customers: ${customers.length}`);
  console.log(`Employees: ${employees.length}`);
  console.log("Projects: 1");
  console.log("");
  console.log("All test accounts use:");
  console.log(`Password: ${TEMPORARY_PASSWORD}`);
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("Seeding failed.");
  console.error(error);
  process.exit(1);
});