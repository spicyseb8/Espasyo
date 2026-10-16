import express from "express";
import cors from "cors";

import { adminAuth, adminDb } from "../firebase-admin.js";
import { requireRole } from "./authorization.js";

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
  const userCollection = adminDb.collection(USERS_COLLECTION);
  const employeeCollection = adminDb.collection(EMPLOYEES_COLLECTION);
  const counterRef = adminDb
    .collection("systemCounters")
    .doc(`account-U-${year}`);
  const idPattern = new RegExp(`^${prefix}(\\d{3,})$`);

  return adminDb.runTransaction(async (transaction) => {
    const [usersSnapshot, employeesSnapshot, counterSnapshot] =
      await Promise.all([
        transaction.get(userCollection),
        transaction.get(employeeCollection),
        transaction.get(counterRef),
      ]);

    let highestNumber = Number(counterSnapshot.data()?.value) || 0;

    for (const document of [
      ...usersSnapshot.docs,
      ...employeesSnapshot.docs,
    ]) {
      const data = document.data();
      const id =
        typeof data.id === "string" ? data.id : document.id;
      const match = id.match(idPattern);

      if (match) {
        highestNumber = Math.max(highestNumber, Number(match[1]));
      }
    }

    let nextNumber = highestNumber + 1;
    let candidateId = `${prefix}${String(nextNumber).padStart(3, "0")}`;
    let [userDoc, employeeDoc] = await Promise.all([
      transaction.get(userCollection.doc(candidateId)),
      transaction.get(employeeCollection.doc(candidateId)),
    ]);

    while (userDoc.exists || employeeDoc.exists) {
      nextNumber += 1;
      candidateId = `${prefix}${String(nextNumber).padStart(3, "0")}`;
      [userDoc, employeeDoc] = await Promise.all([
        transaction.get(userCollection.doc(candidateId)),
        transaction.get(employeeCollection.doc(candidateId)),
      ]);
    }

    transaction.set(counterRef, {
      value: nextNumber,
      updated_at: new Date(),
    });

    return candidateId;
  });
}

// --------------------------------------------------
// CREATE ACCOUNT
// --------------------------------------------------

router.post("/accounts", requireRole("superadmin"), async (req, res) => {
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

    const [usersSnapshot, employeesSnapshot] = await Promise.all([
      adminDb.collection(USERS_COLLECTION).get(),
      adminDb.collection(EMPLOYEES_COLLECTION).get(),
    ]);
    const emailAlreadyRecorded = [
      ...usersSnapshot.docs,
      ...employeesSnapshot.docs,
    ].some((document) => {
      const existingEmail = document.data().email;
      return (
        typeof existingEmail === "string" &&
        existingEmail.trim().toLowerCase() === normalizedEmail
      );
    });

    if (emailAlreadyRecorded) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

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
      if (error.code === "auth/email-already-exists") {
        return res.status(409).json({
          success: false,
          message: "An account with this email already exists.",
        });
      }

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
          .create(userData);
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
        .create(employeeData);
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