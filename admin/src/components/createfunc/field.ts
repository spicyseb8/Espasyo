export interface ValidationResult {
    valid: boolean;
    message?: string;
}

// --------------------------------------------------
// NAME
// --------------------------------------------------

export function validateName(value: string): ValidationResult {
    const name = value.trim();

    if (!name) {
        return {
            valid: false,
            message: "Name is required.",
        };
    }

    if (name.length < 2) {
        return {
            valid: false,
            message: "Name must be at least 2 characters.",
        };
    }

    if (name.length > 100) {
        return {
            valid: false,
            message: "Name must not exceed 100 characters.",
        };
    }

    // Allows:
    // Juan Dela Cruz
    // Juan P. Dela Cruz
    // Mary-Jane
    // O'Connor
    const namePattern = /^[A-Za-zÀ-ÿ]+(?:[ .'-][A-Za-zÀ-ÿ]+)*$/;

    if (!namePattern.test(name)) {
        return {
            valid: false,
            message:
                "Name can only contain letters, spaces, periods, hyphens, and apostrophes.",
        };
    }

    return { valid: true };
}

// --------------------------------------------------
// PHONE
// --------------------------------------------------

export function formatPhone(value: string): string {
    // Keep digits only
    let digits = value.replace(/\D/g, "");

    // Convert 09XXXXXXXXX -> 63XXXXXXXXXX
    if (digits.startsWith("0")) {
        digits = "63" + digits.slice(1);
    }

    // Convert +63XXXXXXXXXX -> 63XXXXXXXXXX
    if (digits.startsWith("63")) {
        digits = digits.slice(0, 12);
    }

    // If user starts entering 9XXXXXXXXX
    else if (digits.startsWith("9")) {
        digits = "63" + digits.slice(0, 10);
    }

    // +63 XXX XXX XXXX
    if (digits.length <= 2) {
        return digits ? `+${digits}` : "";
    }

    if (digits.length <= 5) {
        return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    }

    if (digits.length <= 8) {
        return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    }

    return `+${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 12)}`;
}

export function validatePhone(value: string): ValidationResult {
    const phone = value.trim();

    if (!phone) {
        return {
            valid: false,
            message: "Phone number is required.",
        };
    }

    const phonePattern = /^\+63 9\d{2} \d{3} \d{4}$/;

    if (!phonePattern.test(phone)) {
        return {
            valid: false,
            message: "Use the format +63 XXX XXX XXXX.",
        };
    }

    return { valid: true };
}

// --------------------------------------------------
// GMAIL
// --------------------------------------------------

export function validateEmail(value: string): ValidationResult {
    const email = value.trim().toLowerCase();

    if (!email) {
        return {
            valid: false,
            message: "Email is required.",
        };
    }

    if (email.length > 254) {
        return {
            valid: false,
            message: "Email address is too long.",
        };
    }

    const gmailPattern =
        /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@gmail\.com$/;

    if (!gmailPattern.test(email)) {
        return {
            valid: false,
            message: "Please enter a valid Gmail address.",
        };
    }

    return { valid: true };
}

// --------------------------------------------------
// PASSWORD
// --------------------------------------------------

export function validatePassword(value: string): ValidationResult {
    if (!value) {
        return {
            valid: false,
            message: "Password is required.",
        };
    }

    if (value.length < 8) {
        return {
            valid: false,
            message: "Password must be at least 8 characters.",
        };
    }

    if (value.length > 128) {
        return {
            valid: false,
            message: "Password must not exceed 128 characters.",
        };
    }

    if (/\s/.test(value)) {
        return {
            valid: false,
            message: "Password cannot contain spaces.",
        };
    }

    if (!/[A-Z]/.test(value)) {
        return {
            valid: false,
            message: "Password must contain at least one uppercase letter.",
        };
    }

    if (!/[a-z]/.test(value)) {
        return {
            valid: false,
            message: "Password must contain at least one lowercase letter.",
        };
    }

    if (!/[0-9]/.test(value)) {
        return {
            valid: false,
            message: "Password must contain at least one number.",
        };
    }

    return { valid: true };
}

// --------------------------------------------------
// ADDRESS
// --------------------------------------------------

export function validateAddress(value: string): ValidationResult {
    const address = value.trim();

    if (!address) {
        return {
            valid: false,
            message: "Address is required.",
        };
    }

    if (address.length < 3) {
        return {
            valid: false,
            message: "Address is too short.",
        };
    }

    if (address.length > 255) {
        return {
            valid: false,
            message: "Address must not exceed 255 characters.",
        };
    }

    return { valid: true };
}