export type LegalDocument =
  | "terms"
  | "privacy"
  | "project-participation"
  | "project-adjustment";

export type LegalContactRow = {
  label: string;
  value: string;
  kind: "email" | "phone" | "address" | "text";
};

export type LegalBlock =
  | { type: "p"; text: string; lead?: string }
  | { type: "list"; items: string[] }
  | { type: "contact"; rows: LegalContactRow[] };

export type LegalSection = {
  title: string;
  blocks: LegalBlock[];
  /** Highlights the whole section as an important notice. */
  callout?: boolean;
};

export type LegalDocumentData = {
  id: LegalDocument;
  /** Short name used in navigation and tabs. */
  navTitle: string;
  /** Full title shown at the top of the document. */
  title: string;
  organization: string;
  effective: string;
  version?: string;
  intro: string[];
  sections: LegalSection[];
};

const ORGANIZATION = "JOCER Construction Services";
const EMAIL = "jocerconstructionservices@gmail.com";
const PHONE = "0939 735 2144";
const ADDRESS = "#33, Santan Street, Brgy. Bagong Bayan, San Pablo City, Laguna, 4000";

const TERMS_EFFECTIVE_DATE = "August 2026";
const PRIVACY_EFFECTIVE_DATE = "August 2026";
const PROJECT_EFFECTIVE_DATE = "17 November 2026";
const PROJECT_VERSION = "2026.11";

const section = (
  title: string,
  body: Array<string | LegalBlock>,
  callout = false,
): LegalSection => ({
  title,
  callout,
  blocks: body.map(block =>
    typeof block === "string" ? ({ type: "p", text: block } as const) : block,
  ),
});

const list = (...items: string[]): LegalBlock => ({ type: "list", items });
const contact = (...rows: LegalContactRow[]): LegalBlock => ({ type: "contact", rows });

const EMAIL_ROW: LegalContactRow = { label: "Email", value: EMAIL, kind: "email" };
const PHONE_ROW: LegalContactRow = { label: "Phone", value: PHONE, kind: "phone" };
const ADDRESS_ROW: LegalContactRow = { label: "Address", value: ADDRESS, kind: "address" };

const TERMS: LegalDocumentData = {
  id: "terms",
  navTitle: "Terms of Service",
  title: "ESPASYO Terms of Service",
  organization: ORGANIZATION,
  effective: TERMS_EFFECTIVE_DATE,
  intro: [
    "These Terms of Service govern access to and use of the ESPASYO platform and related services provided by JOCER Construction Services. ESPASYO is an interior design planning and project coordination platform used to create project concepts, store design information, prepare preliminary cost estimates, and support communication between clients and the company.",
    "By creating an account, accessing ESPASYO, or participating in a project through the platform, you confirm that you have read, understood, and agree to be bound by these Terms.",
  ],
  sections: [
    section("Introduction and scope", [
      "ESPASYO is a digital design and planning environment operated by JOCER Construction Services. It supports project intake, room layout planning, material selection, preliminary cost estimation, design review, and administrative coordination.",
      "These Terms apply to all users, including clients, administrators, and any other persons who access or use the platform. ESPASYO is not a substitute for a formal construction contract, engineering certification, architectural approval, or final commercial agreement.",
    ]),
    section("Definitions", [
      "For these Terms, “Platform” means the ESPASYO website, application, project portals, related interfaces, and associated digital services; “Company” means JOCER Construction Services; “User” means any person who accesses or uses the Platform; and “Project” means a project record, concept, design submission, or other work created or managed through the Platform.",
    ]),
    section("Eligibility and account registration", [
      "Users must provide accurate and current information when registering for and using the Platform. Access is granted only to persons with the legal capacity to enter into a valid arrangement and to those permitted to use the associated account or project.",
      "The Company may reject, suspend, or restrict an account where an account is inaccurate, unauthorized, misused, or otherwise inconsistent with these Terms or applicable law.",
    ]),
    section("User responsibilities and account security", [
      "Users are responsible for maintaining the confidentiality of their login details and for all activity conducted through their account. Users must take reasonable steps to protect their credentials and must promptly notify the Company where they suspect unauthorized access, misuse, or a security issue.",
      "Users agree to provide truthful project information, use the Platform in a lawful and reasonable manner, and avoid actions that disrupt platform operation or compromise account security.",
    ]),
    section("Permitted use", [
      "The Platform may be used for the preparation of design concepts, room planning, material selection, budgeting support, communication with the Company, and the administration of a user’s own project.",
      list(
        "Create, save, and review project records and design proposals.",
        "Submit project information and materials necessary for concept review.",
        "Receive administrative feedback and project-related instructions.",
        "Retrieve project records, drafts, and relevant outputs made available through the Platform.",
      ),
    ]),
    section("Prohibited activities", [
      "Users must not use ESPASYO for unlawful, abusive, deceptive, or disruptive purposes. Prohibited conduct includes, without limitation, unauthorized access to accounts or project records, misuse of project data, use of the Platform for unlawful purposes, uploading materials without lawful rights, tampering with system records, and any conduct that interferes with platform availability or security.",
    ]),
    section("User-submitted content and project information", [
      "Users remain responsible for the accuracy, completeness, and lawfulness of all information they enter, upload, or submit through the Platform. This includes project descriptions, room measurements, layout details, selected materials, uploaded references, and other design-related content.",
      "Users must not upload or provide content that they do not have the right to use, distribute, or store. The Company may remove or decline content where required by law, accepted policy, operational necessity, or any reasonable concern about rights infringement or misuse.",
    ]),
    section("Ownership of platform materials and company assets", [
      "ESPASYO, its software, interfaces, layouts, templates, algorithms, design assets, branding, and related materials remain the property of the Company or its licensors, except where rights belong to a third party.",
      "Users retain ownership of their own original content and project contributions that they lawfully provide, subject to any applicable rights of third parties and any separate agreement governing the project.",
    ]),
    section("Project designs and user rights", [
      "Users may retain rights in their original project input, designs, documents, and concept materials that they lawfully create or provide. The Company does not automatically transfer ownership of its platform assets, templates, or proprietary tools to users simply because a user designs or stores a project through ESPASYO.",
      "Project information may be used to administer, review, and coordinate the relevant project, but use of a user’s design for public marketing, portfolio display, or similar purposes requires the applicable separate consent or authorization.",
    ]),
    section("Project records, saving, and data accuracy", [
      "Users are responsible for saving project work and reviewing the records associated with their design. The Platform may record project changes, administrative actions, deadlines, comments, revision requests, and submissions.",
      "The Company makes reasonable efforts to preserve project records, but the Platform may be affected by outages, software defects, connectivity issues, or operational interruptions. Users should keep their own backup copies of important design information where practical.",
    ]),
    section("Platform availability and technical limitations", [
      "The Company will use reasonable efforts to maintain the availability and integrity of ESPASYO and the project records associated with it. However, no digital service can be guaranteed to be uninterrupted, free from defects, or error-free. Maintenance, software updates, third-party disruptions, and technical limitations may temporarily affect availability or performance.",
    ]),
    section("Digital design and visualization disclaimers", [
      "ESPASYO produces visualizations, room layouts, materials presentations, and preliminary cost estimates based on user-provided data and the system’s available catalogs and assumptions. These outputs are planning and design aids.",
      "A 3D visualization, floor plan, material preview, or cost estimate is not automatically a construction-ready drawing, engineering certification, technical specification, or authorization to proceed with physical works.",
    ]),
    section(
      "Construction, engineering, and technical limitations",
      [
        {
          type: "p",
          lead: "Important:",
          text: "The Platform does not replace professional architectural, engineering, structural, electrical, or construction assessment. The accuracy of dimensions, site conditions, material quantities, building constraints, structural feasibility, and compliance requirements must be validated independently.",
        },
        "Final construction scope, pricing, implementation requirements, warranties, and other commercial matters must be governed by the applicable separate written agreements and formal technical review process.",
      ],
      true,
    ),
    section("Relationship to construction and commercial agreements", [
      "ESPASYO supports planning and coordination only. It does not replace a construction agreement, quotation, payment arrangement, material specification agreement, or any other contract for physical works or services.",
      "Any construction scope, cost, implementation arrangements, payment terms, guarantees, or obligations must be documented separately through the Company’s proper business processes and approved written agreements.",
    ]),
    section("Third-party services and integrations", [
      "ESPASYO may rely on third-party platforms, infrastructure providers, hosting services, authentication services, storage services, and communication tools to operate. The Company will use reasonable care in selecting such providers, but it cannot guarantee their uninterrupted or error-free operation.",
    ]),
    section("Confidentiality and project information", [
      "The Company will process project information for the purpose of managing and administering the relevant project, providing design feedback, and fulfilling its operational responsibilities. Users should avoid entering sensitive personal information into areas that are not intended for that purpose.",
      "Information may be shared with internal personnel or authorized service providers as necessary to provide the Platform and related project administration services.",
    ]),
    section("Account suspension and termination", [
      "The Company may suspend or terminate access where a user violates these Terms, misuses the Platform, provides inaccurate information, poses a security risk, or otherwise fails to comply with this agreement or applicable law.",
      "Termination does not automatically cancel any separate legal or commercial obligations or any rights that are otherwise governed by law or a separate written agreement.",
    ]),
    section("Privacy and personal information", [
      "Personal information is collected, stored, and processed only for specified and legitimate purposes associated with account management, project operations, administrative review, and support of the Platform.",
      "Users should refer to the Privacy Policy for more detailed information on the categories of data processed, the lawful basis for processing, storage practices, rights, and contact information.",
    ]),
    section("Changes to the Terms", [
      "The Company may update these Terms from time to time to reflect operational changes, legal requirements, product adjustments, or policy developments. Updated Terms will be made available through the Platform.",
      "Continued use of the Platform after an update signifies acceptance of the revised Terms, subject to any separate requirement for explicit acknowledgment where applicable.",
    ]),
    section("Governing law and dispute resolution", [
      "These Terms are governed by the laws of the Republic of the Philippines, without regard to conflict-of-laws principles. Any dispute arising out of or relating to the Platform or these Terms may be addressed through good-faith discussion, administrative review, or the appropriate legal remedies available under Philippine law.",
    ]),
    section("Contact information and acknowledgment", [
      "Questions regarding these Terms may be directed to the Company at the contact details below.",
      contact(EMAIL_ROW, PHONE_ROW, ADDRESS_ROW),
      "By using ESPASYO, the User acknowledges that they have read, understood, and accepted the Terms of Service and that the Platform is intended to support design planning and project coordination, not construction authorization or a final construction agreement.",
    ]),
  ],
};

const PRIVACY: LegalDocumentData = {
  id: "privacy",
  navTitle: "Privacy Policy",
  title: "ESPASYO Privacy Policy",
  organization: ORGANIZATION,
  effective: PRIVACY_EFFECTIVE_DATE,
  intro: [
    "This Privacy Policy explains how ESPASYO collects, uses, stores, discloses, and protects personal information in connection with the operation of the platform. ESPASYO is developed and operated by JOCER Construction Services for interior design planning, project coordination, and business administration.",
    "This Policy is intended to align with the principles of Republic Act No. 10173, the Data Privacy Act of 2012, and the applicable implementing rules and regulations, while being written in clear language for ordinary users.",
  ],
  sections: [
    section("Introduction and scope", [
      "This Policy applies to all personal information processed by the Company in connection with the ESPASYO platform, including account creation, project records, support requests, and administrative activities.",
      "The Company processes personal information only for specified and legitimate purposes that are necessary to operate, maintain, and improve the Platform and to administer project-related services.",
    ]),
    section("Identity of the personal information controller", [
      "For purposes of this Policy, JOCER Construction Services is the personal information controller for personal information processed in connection with the ESPASYO platform, unless otherwise specified in a separate agreement or lawful arrangement.",
    ]),
    section("Categories of personal information collected", [
      "ESPASYO may collect and process the following categories of information:",
      list(
        "Account and identification details, including name, email address, login information, and account status.",
        "Project information, including design data, room dimensions, material selections, layout information, and project records.",
        "Communication records, such as project comments, messages, request submissions, and follow-up information.",
        "Technical and device information associated with access to the Platform, including session metadata and operational logs.",
        "Administrative and support information relevant to project administration, account validation, or service delivery.",
      ),
    ]),
    section("Account and identification information", [
      "The Company may collect basic account details required to register and manage a user account, including contact details, login credentials, and project ownership or assignment information.",
      "Users must provide accurate and current information and remain responsible for maintaining the confidentiality of their account.",
    ]),
    section("Project and design information", [
      "Project-related information may be collected and stored to allow users to create, review, save, and modify their proposed designs. This may include room measurements, selected materials, item quantities, layout changes, design preferences, uploaded references, and related estimates.",
      "These records are used to support design planning, project review, communication, and the preparation of project-related outputs.",
    ]),
    section("Communication and activity records", [
      "ESPASYO may retain information about project activity, account actions, saved drafts, saved revisions, administrative comments, review outcomes, deadlines, and support-related communications. This information helps the Company maintain project history and coordinate work.",
    ]),
    section("Technical and security information", [
      "The Company may use technical logs, access information, and operational metadata to maintain platform integrity, support account verification, and investigate issues. This may include information concerning authentication attempts, account status, access events, and related platform operations.",
      "The Company does not claim absolute security for any online system, but it applies reasonable operational controls relevant to the services it provides.",
    ]),
    section("Purposes of processing", [
      "Personal information is processed for the following purposes:",
      list(
        "To create, manage, and maintain user accounts.",
        "To operate the ESPASYO platform and facilitate project creation, editing, and review.",
        "To provide design assistance, preliminary cost estimation, and project administration support.",
        "To communicate with users regarding project status, feedback, deadlines, and relevant updates.",
        "To maintain internal records and activity history in support of project management.",
        "To comply with legal, regulatory, or administrative obligations where applicable.",
      ),
    ]),
    section("Lawful basis and privacy principles", [
      "Processing is carried out in accordance with lawful and legitimate purposes connected with the operation of ESPASYO and the administration of client projects. The Company will process personal information only to the extent necessary for those purposes and will respect the privacy rights of data subjects under applicable law.",
      "Where a separate legal basis or consent requirement is required, the Company will handle it in accordance with the applicable legal framework and process.",
    ]),
    section("Data sharing and authorized recipients", [
      "ESPASYO may share personal information with authorized internal users, administrators, and service providers where necessary to support account management, project review, technical operation, or legal compliance.",
      "Personal information is not generally made public. The Company does not sell personal information to third parties for marketing purposes.",
    ]),
    section("Third-party service providers and processors", [
      "The Platform may rely on third-party infrastructure and software services, including authentication, storage, hosting, and related operational support. The Company will use reasonable care when selecting providers and will only share information needed to operate those services.",
      "The Company does not list every provider here because operational arrangements may change, but users should understand that the Platform may include integrated third-party services necessary for operation, security, and reliability.",
    ]),
    section("Storage and security safeguards", [
      "The Company stores personal information in systems used to support ESPASYO, including Firebase and related infrastructure used for account management and project records. Reasonable technical and organizational safeguards are used to reduce the risk of unauthorized access, misuse, or loss.",
      "No online system can guarantee absolute security. Users should protect their credentials and should avoid storing sensitive personal information in project titles, design descriptions, or other fields not intended for that purpose.",
    ]),
    section("Retention and disposal", [
      "Personal information may be retained for as long as necessary to provide the Platform, maintain project records, comply with legal obligations, and support operational requirements. When information is no longer necessary, it may be deleted or updated in accordance with applicable procedures.",
    ]),
    section("International transfers", [
      "Personal information may be stored or processed through third-party systems or infrastructure that may involve data transfers outside the Philippines, depending on the service arrangements in place. The Company will take reasonable steps to ensure that such transfers are conducted in a manner consistent with applicable data protection requirements.",
    ]),
    section("Data subject rights", [
      "Depending on the applicable legal context, users may have rights to access, correct, update, restrict, or request deletion of personal information, subject to legal exceptions, operational constraints, and the Company’s obligations.",
      "Where a request is made, the Company will review it in accordance with applicable law and its operational procedures. Users may contact the Company to inquire about processing, access requests, and related matters.",
    ]),
    section("Privacy-related requests and procedures", [
      "Requests concerning privacy, access, correction, or other personal-information concerns may be submitted through the Company’s designated contact channels. The Company may request reasonable information to confirm the identity of the requester before processing a request.",
    ]),
    section("Cookies and similar technologies", [
      "ESPASYO may use cookies, local storage, session data, and similar technologies to maintain session continuity, support authentication, and improve user experience. These tools may store identifiers or session-related information on the user’s device for operational purposes.",
    ]),
    section("Breach handling", [
      "The Company will take reasonable steps to respond promptly to a suspected data security incident, investigate the issue, and take appropriate remedial action in accordance with applicable law and operational requirements.",
    ]),
    section("Children and minors", [
      "ESPASYO is intended for use by persons with lawful authority to access and use the platform. The Company does not intentionally rely on processing personal information from children in a manner inconsistent with applicable law.",
    ]),
    section("Policy updates", [
      "This Policy may be updated when operational practices, legal requirements, or platform features change. Users are encouraged to review the document periodically. Continued use of the Platform after a change in this Policy means that the user accepts the updated terms, subject to any required separate acknowledgment.",
    ]),
    section("Contact information and complaints", [
      "For questions, requests, or concerns regarding this Privacy Policy, please contact the Company at the details below.",
      contact(
        { label: "Organization", value: ORGANIZATION, kind: "text" },
        { label: "System", value: "ESPASYO", kind: "text" },
        EMAIL_ROW,
        PHONE_ROW,
        ADDRESS_ROW,
      ),
      "By continuing to use ESPASYO, users acknowledge that they have read this Privacy Policy and understand that personal information is processed for the operation of the platform and related business administration in accordance with applicable law.",
    ]),
  ],
};

const PROJECT_PARTICIPATION: LegalDocumentData = {
  id: "project-participation",
  navTitle: "Project Participation Agreement",
  title: "Client Project Participation and Coordination Agreement",
  organization: ORGANIZATION,
  effective: PROJECT_EFFECTIVE_DATE,
  version: PROJECT_VERSION,
  intro: [
    "This Agreement establishes the responsibilities, expectations, and coordination procedures between JOCER Construction Services and the assigned client when participating in an interior design project through ESPASYO.",
    "ESPASYO provides a digital environment for creating, modifying, saving, submitting, and reviewing interior design concepts and project information. The project record and approved updates serve as the formal operational reference for the work performed through the Platform.",
  ],
  sections: [
    section("Purpose and scope", [
      "This Agreement governs the digital project participation and coordination process between the Company and the Client. It does not independently constitute a construction contract, final quotation, payment agreement, engineering certification, building permit, or authorization to begin physical works.",
      "Separate written arrangements are required for construction scope, pricing, payment terms, material specifications, implementation, warranties, and other commercial obligations.",
    ]),
    section("Parties and project record", [
      "The parties are JOCER Construction Services and the person or entity identified as the Client in the relevant project record. Each assigned project shall include, where applicable, the project ID, name, client account, assigned company representative, project description, initial requirements, deadline, and any relevant operational instructions.",
    ]),
    section("Responsibilities of the Company", [
      "The Company will make reasonable efforts to provide project information and the available structural or design basis, provide instructions relating to the platform workflow, maintain access subject to technical limits and circumstances beyond reasonable control, review submitted materials, provide relevant feedback or revision requests, communicate important updates or deadlines, and maintain records of project activity and acknowledgments.",
    ]),
    section("Responsibilities of the Client", [
      "The Client is responsible for providing accurate and complete project information, reviewing assigned project details before beginning design work, using ESPASYO responsibly, protecting account access, saving work appropriately, submitting the project through the designated process, reviewing administrative feedback, and informing the Company of any material changes affecting schedule, scope, or project viability.",
    ]),
    section("Project commencement, deadlines, and extensions", [
      "Each project shall have an initial deadline established by the Company and made visible through the Platform. The deadline serves as an operational schedule for participation and review. If a client anticipates delay, the client should notify the Company as soon as reasonably practicable.",
      "A missed deadline does not automatically cancel the project or result in a new charge. The Company may approve a reasonable extension, propose a revised schedule, request consultation, or otherwise determine an appropriate resolution. Any approved revision must be recorded in the project record before it is treated as effective.",
    ]),
    section("Consultations and communication records", [
      "Communication may occur through ESPASYO, face-to-face consultation, telephone, email, or another mutually accepted method. Where a consultation results in an agreed decision or adjustment, the relevant outcome should be recorded by the authorized Company representative.",
      "Informal discussions do not automatically amend an existing agreement unless the parties clearly agree, the change is documented, and any necessary acknowledgment is completed.",
    ]),
    section("Revisions and scope changes", [
      "The Company may request revisions where a submitted design requires clarification or further development. The Client may also request changes during the project.",
      "Material changes affecting scope, requirements, deliverables, or timing should be discussed and documented. The number and nature of revisions depend on the individual project, and this Agreement does not promise unlimited revisions. Additional work, fees, or construction-related changes require a separate written arrangement.",
    ]),
    section("Temporary pauses and resumption", [
      "Either party may request a temporary pause when continuing progress is impractical. A pause should identify the reason, start date, expected review date, and any agreed conditions. A pause does not cancel the project, but the parties should agree on a path to resume and document any revised deadline before work continues under a new schedule.",
    ]),
    section("Submission, review, and approval", [
      "The Client should submit the digital design through the designated ESPASYO process. The Company may approve the submission, request revisions, or return the project for further development.",
      "An approval in ESPASYO means the digital design has passed the applicable platform review stage. It does not certify structural safety, guarantee feasibility, confirm material availability, establish final pricing, or authorize physical construction.",
    ]),
    section("Digital design limitations", [
      "Digital floor plans, measurements, 3D models, furniture placements, material previews, and visual representations are planning and visualization references only. Their accuracy depends on the information supplied, available assets, software limitations, and assumptions used in design. Relevant dimensions, site conditions, structural requirements, regulations, material availability, and technical feasibility must be independently verified before implementation.",
    ]),
    section("Ownership and use of project materials", [
      "Each party retains rights in the materials and contributions they lawfully own. The Company retains rights in its own pre-existing materials, software, templates, and proprietary resources.",
      "Access to Company-provided assets through ESPASYO does not automatically transfer ownership of those assets to the Client. Use of a Client’s design for public promotion, portfolio display, or marketing requires the applicable separate authorization.",
    ]),
    section("Project inactivity and discontinuation", [
      "Inactivity alone does not automatically constitute abandonment or cancellation. If a project becomes inactive, the Company may contact the Client to determine whether the client intends to continue. The parties may agree to continue under the original schedule, establish a revised deadline, temporarily pause the project, arrange a consultation, revise the scope, or discontinue the project through the formal cancellation process.",
      "Cancellation in ESPASYO does not automatically cancel a separate service or construction agreement. Financial or contractual obligations remain governed by the relevant separate agreement and applicable law.",
    ]),
    section("Disputes and resolution", [
      "The parties should first attempt to resolve concerns through good-faith communication. Where the issue cannot be resolved informally, they may proceed through the appropriate administrative review or legal process available under Philippine law and any separate agreement.",
    ]),
    section("Acknowledgment and versioning", [
      "This Agreement may be versioned and associated with a specific project record. The version number and acceptance timestamp are used to identify which terms were in effect at the time of acknowledgment. Acknowledgment is specific to the associated project and authenticated account and must not be treated as automatic approval for another project or user.",
    ]),
  ],
};

const PROJECT_ADJUSTMENT: LegalDocumentData = {
  id: "project-adjustment",
  navTitle: "Project Adjustment Policy",
  title: "Project Adjustment and Resolution Policy",
  organization: ORGANIZATION,
  effective: PROJECT_EFFECTIVE_DATE,
  version: PROJECT_VERSION,
  intro: [
    "This Policy sets out a fair and consistent process for handling project adjustments, schedule changes, missed deadlines, activity concerns, technical issues, and resolution requests relating to a project managed through ESPASYO.",
  ],
  sections: [
    section("Purpose and scope", [
      "This Policy applies where a project requires clarification, revision, rescheduling, temporary pause, administrative review, or formal resolution of an issue. It supplements the project participation framework and does not replace any separate construction, commercial, or legal arrangements.",
    ]),
    section("Guiding principles", [
      "The Company will act reasonably, document material changes clearly, and provide both parties an opportunity to review and respond where a request affects the project schedule, scope, or status. A request does not automatically become an approved change, and a missed deadline does not automatically cancel a project.",
    ]),
    section("Communication and notification", [
      "The party raising an issue should provide clear information about the situation, proposed action, required response, and any relevant timeline. The Company may acknowledge the concern, request clarification, propose a counterproposal, or reject the request with reasons.",
    ]),
    section("Missed deadlines", [
      "If a deadline is missed, the project may be marked as pending action or past due and the Company may send reminders or request confirmation of the next steps. The Company may consider an extension or revised schedule, but it must also consider the client’s explanation and the project circumstances.",
    ]),
    section("Client inactivity", [
      "Where a project becomes inactive, the Company may contact the client to determine whether the client intends to continue. Inactivity is not treated as automatic cancellation or penalty. The Company may propose a revised deadline, pause the project, or initiate administrative review, but any material change must be recorded and acknowledged.",
    ]),
    section("Company-side delays", [
      "The Company may need to revise a schedule due to internal responsibilities, technical constraints, resource availability, or project preparation. Any such adjustment should be communicated promptly and recorded in the project history so that the client understands the basis and timing of the change.",
    ]),
    section("Extension requests", [
      "An extension request should include the reason for the request, the requested additional time, and any relevant circumstances affecting project progress. The Company may approve, decline, or propose a different arrangement. Approval becomes effective only after the authorized representative records the decision and communicates it to the Client.",
    ]),
    section("Temporary pauses and resumption", [
      "Temporary pauses may be requested where progress is impractical. The parties should agree on the expected review date and the conditions for continuation. Any revised schedule must be recorded before the project resumes under a new timeline.",
    ]),
    section("Consultations and clarification requests", [
      "Consultations may be used to clarify requirements, resolve confusion, review a design issue, or discuss a change in direction. A consultation record may include the date, attendees, summary, agreed action, and any revised deadline or scope terms. A consultation record does not automatically amend the project unless the change is clearly accepted and properly documented.",
    ]),
    section("Scope changes and approval", [
      "Material changes to scope, deliverables, expected outputs, or schedule require discussion and documentation. The Company may request clarification, approve a change in principle, reject it, or issue a counterproposal. Any material adjustment requiring mutual acknowledgment must be recorded before it becomes effective.",
    ]),
    section("Technical issues and platform interruptions", [
      "If a verified technical issue materially affects project participation or review, the parties should consider a schedule adjustment. Technical interruptions alone do not constitute ordinary client inactivity where the issue was outside the client’s reasonable control.",
    ]),
    section("Project withdrawal and discontinuation", [
      "A project may be discontinued where the Client requests withdrawal or the Company concludes continuation is no longer practical. The parties should clarify the reason, current status, outstanding revisions, access to records, and any pending matters governed by separate agreements.",
    ]),
    section("Administrative review", [
      "Where unresolved concerns exist, the Company may place the project under administrative review. During this period, the project remains subject to appropriate status controls and access rules. Administrative review does not automatically convert the project to submitted, approved, or cancelled status.",
    ]),
    section("Documentation and activity history", [
      "Project adjustments, extension requests, clarification notes, consultation summaries, status changes, and final decisions should be preserved in the project record and history. This supports transparency and prevents informal discussions from being treated as binding decisions without proper acknowledgment.",
    ]),
    section("Relationship with the client agreement and final obligations", [
      "This Policy works alongside the Client Project Participation and Coordination Agreement and does not override any separate construction contract, commercial arrangement, or statutory rights. The Company may apply reasonable operational defaults, such as reminder intervals, but these are not binding contractual deadlines unless otherwise recorded and acknowledged.",
    ]),
  ],
};

export const LEGAL_DOCUMENTS: Record<LegalDocument, LegalDocumentData> = {
  terms: TERMS,
  privacy: PRIVACY,
  "project-participation": PROJECT_PARTICIPATION,
  "project-adjustment": PROJECT_ADJUSTMENT,
};

export const LEGAL_DOCUMENT_ORDER: LegalDocument[] = [
  "terms",
  "privacy",
  "project-participation",
  "project-adjustment",
];

/** Documents a user must read to the end before agreeing. */
export const REQUIRED_DOCUMENTS: LegalDocument[] = ["terms", "privacy"];

export function sectionId(document: LegalDocument, n: number) {
  return `${document}-section-${n}`;
}

export type LegalOutlineItem = { id: string; n: number; title: string };

export function getLegalOutline(document: LegalDocument): LegalOutlineItem[] {
  const data = LEGAL_DOCUMENTS[document];
  if (!data) return [];
  return data.sections.map((s, index) => ({
    id: sectionId(document, index + 1),
    n: index + 1,
    title: s.title,
  }));
}

/** Rough reading time at ~220 words per minute. */
export function getReadingMinutes(document: LegalDocument) {
  const data = LEGAL_DOCUMENTS[document];
  if (!data) return 1;
  const texts: string[] = [...data.intro];
  for (const s of data.sections) {
    texts.push(s.title);
    for (const block of s.blocks) {
      if (block.type === "p") texts.push(block.text);
      if (block.type === "list") texts.push(...block.items);
    }
  }
  const words = texts.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}