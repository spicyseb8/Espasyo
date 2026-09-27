import express from "express";
import cors from "cors";

import { adminAuth, adminDb } from "../firebase-admin.js";

const router = express.Router();

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const USERS_COLLECTION = "users";
const EMPLOYEES_COLLECTION = "adminEmployees";

// --------------------------------------------------
// GENERATE NEXT ACCOUNT ID
// --------------------------------------------------

async function generateAccountId() {
  const year = new Date().getFullYear().toString().slice(-2);

  const prefix = `U-${year}`;

  let highestNumber = 0;

  // ----------------------------------------------
  // Check users
  // ----------------------------------------------

  const usersSnapshot = await adminDb
    .collection(USERS_COLLECTION)
    .get();

  for (const document of usersSnapshot.docs) {
    const data = document.data();

    const id = data.id || document.id;

    if (typeof id !== "string") {
      continue;
    }

    const match = id.match(
      new RegExp(`^U-${year}(\\d{3,})$`)
    );

    if (match) {
      const number = Number(match[1]);

      if (number > highestNumber) {
        highestNumber = number;
      }
    }
  }

  // ----------------------------------------------
  // Check employees
  // ----------------------------------------------

  const employeesSnapshot = await adminDb
    .collection(EMPLOYEES_COLLECTION)
    .get();

  for (const document of employeesSnapshot.docs) {
    const data = document.data();

    const id = data.id || document.id;

    if (typeof id !== "string") {
      continue;
    }

    const match = id.match(
      new RegExp(`^U-${year}(\\d{3,})$`)
    );

    if (match) {
      const number = Number(match[1]);

      if (number > highestNumber) {
        highestNumber = number;
      }
    }
  }

  // ----------------------------------------------
  // Generate next number
  // ----------------------------------------------

  let nextNumber = highestNumber + 1;

  while (true) {
    const formattedNumber = String(nextNumber).padStart(
      3,
      "0"
    );

    const candidateId = `${prefix}${formattedNumber}`;

    const userDoc = await adminDb
      .collection(USERS_COLLECTION)
      .doc(candidateId)
      .get();

    const employeeDoc = await adminDb
      .collection(EMPLOYEES_COLLECTION)
      .doc(candidateId)
      .get();

    if (!userDoc.exists && !employeeDoc.exists) {
      return candidateId;
    }

    nextNumber++;
  }
}

// --------------------------------------------------
// CREATE ACCOUNT
// --------------------------------------------------

router.post("/accounts", async (req, res) => {
  try {
    const {
      accountType,
      name,
      email,
      password,
      phoneNumber,
      address,
      role,
    } = req.body;

    // ----------------------------------------------
    // Validate account type
    // ----------------------------------------------

    if (
      accountType !== "user" &&
      accountType !== "employee"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid account type. Use user or employee.",
      });
    }

    // ----------------------------------------------
    // Validate name
    // ----------------------------------------------

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    // ----------------------------------------------
    // Validate email
    // ----------------------------------------------

    if (
      typeof email !== "string" ||
      !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    // ----------------------------------------------
    // Validate password
    // ----------------------------------------------

    if (
      typeof password !== "string" ||
      password.length < 6
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters.",
      });
    }

    // ----------------------------------------------
    // Employee role
    // ----------------------------------------------

    if (
      accountType === "employee" &&
      role !== "admin" &&
      role !== "superadmin"
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Employee role must be admin or superadmin.",
      });
    }

    // ----------------------------------------------
    // Normalize email
    // ----------------------------------------------

    const normalizedEmail =
      email.trim().toLowerCase();

    // ----------------------------------------------
    // Check email in Firebase Authentication
    // ----------------------------------------------

    try {
      await adminAuth.getUserByEmail(
        normalizedEmail
      );

      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    } catch (error) {
      if (error.code !== "auth/user-not-found") {
        throw error;
      }
    }

    // ----------------------------------------------
    // Generate Espasyo ID
    // ----------------------------------------------

    const accountId =
      await generateAccountId();

    // ----------------------------------------------
    // Create Firebase Authentication account
    // ----------------------------------------------

    let firebaseUser;

    try {
      firebaseUser =
        await adminAuth.createUser({
          email: normalizedEmail,
          password,
          displayName: name.trim(),
        });
    } catch (error) {
      console.error(
        "Firebase Auth creation failed:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to create Firebase Authentication account.",
      });
    }

    // ----------------------------------------------
    // Prepare timestamps
    // ----------------------------------------------

    const now =
      new Date();

    // ----------------------------------------------
    // USER ACCOUNT
    // ----------------------------------------------

    if (accountType === "user") {
      const userData = {
        id: accountId,

        full_name: name.trim(),

        email: normalizedEmail,

        phone_number:
          typeof phoneNumber === "string"
            ? phoneNumber.trim()
            : "",

        address:
          typeof address === "string"
            ? address.trim()
            : "",

        uid: firebaseUser.uid,

        account_status: "active",

        created_at: now,

        updated_at: now,

        avatar:
          `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
            name.trim()
          )}`,
      };

      try {
        await adminDb
          .collection(USERS_COLLECTION)
          .doc(accountId)
          .set(userData);
      } catch (error) {
        // ------------------------------------------
        // Roll back Firebase Auth if Firestore fails
        // ------------------------------------------

        try {
          await adminAuth.deleteUser(
            firebaseUser.uid
          );
        } catch (rollbackError) {
          console.error(
            "Failed to rollback Firebase Auth user:",
            rollbackError
          );
        }

        throw error;
      }

      return res.status(201).json({
        success: true,

        message:
          "User account created successfully.",

        account: {
          id: accountId,
          uid: firebaseUser.uid,
          name: name.trim(),
          email: normalizedEmail,
          accountType: "user",
          accountStatus: "active",
        },
      });
    }

    // ----------------------------------------------
    // EMPLOYEE ACCOUNT
    // ----------------------------------------------

    const employeeData = {
      id: accountId,

      name: name.trim(),

      email: normalizedEmail,

      role,

      uid: firebaseUser.uid,

      account_status: "active",

      created_at: now,

      updated_at: now,

      avatar:
        `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(
          name.trim()
        )}`,
    };

    try {
      await adminDb
        .collection(EMPLOYEES_COLLECTION)
        .doc(accountId)
        .set(employeeData);
    } catch (error) {
      // --------------------------------------------
      // Roll back Firebase Auth if Firestore fails
      // --------------------------------------------

      try {
        await adminAuth.deleteUser(
          firebaseUser.uid
        );
      } catch (rollbackError) {
        console.error(
          "Failed to rollback Firebase Auth user:",
          rollbackError
        );
      }

      throw error;
    }

    return res.status(201).json({
      success: true,

      message:
        "Employee account created successfully.",

      account: {
        id: accountId,
        uid: firebaseUser.uid,
        name: name.trim(),
        email: normalizedEmail,
        accountType: "employee",
        role,
        accountStatus: "active",
      },
    });
  } catch (error) {
    console.error(
      "Account creation failed:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Failed to create account.",
    });
  }
});

export default router;