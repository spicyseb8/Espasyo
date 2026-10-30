# Espasyo Backend and Business Logic Guide

## Scope and verification

This guide documents behavior evidenced by the local source code. It does not establish that Firebase rules, production configuration, or external scheduled jobs behave the same way. No Firebase data, deployed resources, or application code was changed for this audit. Tests, builds, and runtime behavior were not verified as part of this documentation.

The repository has client and admin React/Vite applications, an Express/Firebase Admin server, and a `gltf-scale` utility. The API server mounts account, asset, comment, and project-deadline routes. Client and a
dmin code also call Firebase directly for several operations.

## 1. Project management

### Create and save flow

1. The client reserves a project ID in a Firestore transaction. It uses `idCounters/projects-<year>`, checks whether a candidate document already exists, then increments the counter. IDs use `PRJ-<sequence><two-digit-year>`. See [`generateNextProjectId`](client/src/Studio/Workspace/panels/ProjectPanel.tsx#L107).
2. [`createProjectData`](client/src/services/projectSerializer.ts#L4) serializes editor state: walls and corners, doors, windows, furniture, openings, floor and wall finishes, blueprint, dimensions/settings, and a calculated cost estimate.
3. The client uploads JSON to `projects/<ownerUid>/<projectId>.json`. If it can capture a scene thumbnail, it uploads `projects/<ownerUid>/<projectId>.jpg`.
4. It writes project metadata to `projects/<projectId>` using `setDoc(..., { merge: true })`. Fields written include `projectId`, `projectName`, `ownerId`, `jsonPath`, `jsonUrl`, `schemaVersion`, `estimatedCost`, `updatedAt`, and, when available, `thumbnailPath` and `thumbnailUrl`. New projects also get `createdAt`. See the save flow in [`ProjectPanel`](client/src/Studio/Workspace/panels/ProjectPanel.tsx#L589).

The JSON upload, thumbnail upload, and Firestore write are separate operations, not one atomic transaction. If a later step fails, previously uploaded files are not removed. A failed save can leave Storage objects without matching metadata. ID reservations are also not rolled back.

### Load, update, and ownership

The client loads the Firestore project document, requires `ownerId === auth.currentUser.uid`, retrieves the JSON using `jsonUrl`, preloads referenced assets, and restores editor state. See [`StudioLoadProject`](client/src/pages/StudioLoadProject.tsx#L155).

When saving an existing project, the client reads the latest project document and checks its owner again before uploading. See [`handleSave`](client/src/Studio/Workspace/panels/ProjectPanel.tsx#L450). These are client-side checks; enforcement for direct Firestore and Storage requests depends on deployed Firebase rules. No local rules files were found.

There is no project deletion endpoint or project deletion operation in the inspected source. Project updates overwrite the JSON at the same path and merge Firestore metadata. Save failures are surfaced in the UI with an error message, but partial uploads are not cleaned up.

Admin project listing reads `projects`, `users`, and `adminEmployees` directly from Firestore and associates owners by ID/UID. See [`projectService`](admin/src/services/assets/projectService.ts#L239).

## 2. Comments

### Creation and storage

An admin writes a comment from the admin project viewer. The client calls `POST /api/projects/:projectId/comments`; the Express server uses a Firestore transaction to create the comment and update its sequence counter. See [`handleSaveComment`](admin/src/components/project-loader/AdminProjectViewer.tsx#L432) and [`project-comments.js`](server/src/main/project-comments.js#L28).

Comment IDs use a yearly counter document at `idCounters/comments-<year>` and the format `CM-<sequence><two-digit-year>`. The transaction stores these `adminComments` fields:

- `id`
- `projectId`
- `targetType`, `targetId`, `targetLabel`, and optional `regionId`
- `text`
- `adminId` and `adminName`
- `status: "open"`
- `createdAt`

The year used in the comment ID is determined in `Asia/Manila`. Admin identity comes from the authenticated Firebase token and matching `adminEmployees` record.

### Retrieval and display

Admin and client applications each subscribe to `adminComments` with a Firestore `onSnapshot` query filtered by `projectId`. The admin viewer displays comments and lets the reviewer create project-level or scene-targeted comments. The client comment panel displays them and can focus the scene on a targeted comment. See [`adminCommentService`](admin/src/services/assets/adminCommentService.ts#L83), [`client adminCommentService`](client/src/services/adminCommentService.ts#L28), and [`AdminComments`](client/src/scene/Comment/AdminComments.tsx#L87).

The write endpoint and admin UI permit role `admin`; they do not include `superadmin` in the allowed role list. Reads are direct Firestore operations, not Express endpoints, so their authorization depends on Firebase rules.

I found no comment reply/update endpoint or code that changes the stored `status`. The server validates required fields and basic types, but does not verify that the project exists or constrain `targetType` to a fixed set.

Comment creation writes only the comment and its counter. It does not write a notification or recent-activity record.

## 3. Deadlines and reminders

### Deadline update

The admin client calls `PATCH /api/projects/:projectId/deadline`. A deadline is either `null` or a valid `YYYY-MM-DD` date that is today or a future date in Asia/Manila. The server verifies the format and actual calendar date, checks the project exists, and updates `deadline` and `updatedAt`. See [`project-deadlines.js`](server/src/main/project-deadlines.js#L11), [`project-deadline-service.js`](server/src/main/project-deadline-service.js#L3), and [`updateProjectDeadline`](admin/src/services/assets/projectService.ts#L98).

### Client enforcement

The client considers a project deadline passed only if the current Philippine date is later than the deadline. The project remains editable during the entire deadline date. The editor reflects the read-only state, checks while open, and checks the current Firestore metadata before saving. See [`projectDeadlineService`](client/src/services/projectDeadlineService.ts#L38), [`ProjectPanel`](client/src/Studio/Workspace/panels/ProjectPanel.tsx#L450), and [`EditorProvider`](client/src/context/EditorProvider.tsx#L491).

### Reminder and deployment findings

No three-day, one-day, due-date, or overdue reminder flow was found. The source contains no scheduled Cloud Functions, reminder deduplication records, or `editingClosesAt` field. No backend project-save endpoint rejects late writes; the client handles the deadline restriction. Thus protection against direct Firebase writes depends on deployed rules or services outside this repository.

No local `firebase.json`, `.firebaserc`, Firestore rules, Storage rules, or Cloud Functions directory was found. This is not proof that no external Firebase configuration or scheduled job exists.

## 4. Asset creation and management

### Create flow and validation

The admin creation form collects the type, name, category, status, price, files, and applicable material settings. Floor dimensions are entered in centimetres and converted to metres before submission. See [`CreateAssetModal`](admin/src/components/createfunc/CreateAssetModal.tsx#L640) and [`flooringDimensions`](admin/src/services/assets/flooringDimensions.ts#L1).

The form sends multipart data to `POST /api/assets`. The endpoint requires a `superadmin`. The server validates:

- Type must be furniture, floor, or wall; name and category must be nonempty.
- Furniture requires a `.glb` model and a supported furniture category.
- Floors require a diffuse image, positive length and width in metres, and a nonnegative per-piece price.
- Walls require a diffuse image or valid six-digit hex color.
- Image maps must have image MIME types; roughness and metalness must be between 0 and 1.
- Furniture decorations/appliances may omit price; other asset types/categories require a nonnegative price.
- Upload limit is five files, each at most 100 MiB. Multer uses memory storage.

The endpoint reserves an ID using `systemCounters`, uploads files to Storage, optionally renders a furniture preview PNG, and then creates the Firestore asset document. On a caught failure it attempts to delete uploaded objects, but does not roll back the reserved counter. See [`create-asset.js`](server/src/main/create-asset.js#L268), [`reserveAssetId`](server/src/main/create-asset.js#L158), and [`createAssetRecord`](server/src/main/create-asset.js#L203).

ID prefixes differ by type: floor `FL-...`, furniture `F-...`, and wall `W-...`. The server checks existing IDs and candidate document collisions. Duplicate detection compares normalized name and category within the same asset type.

Storage objects follow `assets/<type>/<normalized-category>/<assetId>/<role>.<extension>`. Furniture previews are saved as `preview.png` next to the model. Firestore records include `id`, `name`, `asset_type`, `category`, `asset_status`, `created_at`, and `updated_at`; type-specific price, dimensions, material settings, and Storage paths are added as applicable. Floor records use `pricePerPiece`, `length`, and `width`. See the record assembly in [`create-asset.js`](server/src/main/create-asset.js#L505).

### Edit and delete

Admin asset edits use direct Firestore `updateDoc`, not an Express update endpoint. The helper validates price and paired floor dimensions before writing name, category, status, prices/dimensions, and `updated_at`. See [`updateAsset`](admin/src/services/assets/update.ts#L29). Permission enforcement for this direct write therefore depends on deployed Firestore rules.

Deletion uses `DELETE /api/assets/:id`, restricted to a `superadmin`. The server deletes recognized Storage paths first and then deletes the Firestore document. If any Storage deletion fails, it returns an error and retains the record. If Storage deletion succeeds but the Firestore delete fails, the record can remain without its files. Project references are not rewritten. See [`deleteAsset`](server/src/main/create-asset.js#L613).

### Catalog loading and caching

Client catalogs query Firestore `assets` by `asset_type` and resolve Storage paths to download URLs. Floor and wall catalogs and door/window loading include only explicitly available records. Furniture uses a separate loader that accepts both available and not-available records in its catalog handling. Representative implementations: [`floors.ts`](client/src/engine/materials/floors.ts#L186), [`walls.ts`](client/src/engine/materials/walls.ts#L113), [`FirebaseFurnitureLibrary.ts`](client/src/engine/furniture/FirebaseFurnitureLibrary.ts#L442), and [`FirebaseDoorWindowLibrary.ts`](client/src/engine/build/FirebaseDoorWindowLibrary.ts#L312).

Catalogs are cached in module memory rather than maintained as live Firestore subscriptions. Newly created/edited metadata may not appear in an already-open client until its catalog is refreshed or the page reloads.

The client asset startup gate registers a service worker and can synchronize library files. The worker caches successful GET responses by a mapped URL/version and falls back to the network on cache misses. See [`AssetStartupGate`](client/src/engine/AssetStartupGate.tsx#L366), [`assetLibraryCache`](client/src/lib/assetLibraryCache.ts#L496), and [`asset-cache-sw.js`](client/public/asset-cache-sw.js#L130). Admin asset editing/deletion also calls cache invalidation helpers. Service-worker caching concerns file responses, not Firestore catalog metadata.

## 5. Notifications and recent activity

No source writes or reads a `notifications` or `adminActivity` collection. No recipient selection, read/unread state, or notification subscription was found.

- Client navigation contains a placeholder to connect a notification indicator to a real source: [`NavBar.tsx`](client/src/pages/NavBar.tsx#L60).
- Admin Home displays sample activity items: [`Home.tsx`](admin/src/components/pages/Home.tsx#L57).
- Account Settings displays mock recent activities: [`RecentActivitiesTab.tsx`](admin/src/components/pages/AccountSettings/RecentActivitiesTab.tsx#L8).
- Comment creation writes `adminComments` and its ID counter only.
- Project save, account changes, and asset create/edit/delete do not call activity or notification handlers in the inspected source.

Consequently, comments are displayed through Firestore subscriptions but do not trigger a separate notification or activity record.

## 6. Accounts and permissions

### Account creation

`POST /api/accounts` is superadmin-only. It validates account type, name, email, password length, and employee role. It creates a Firebase Auth user and then a Firestore record in `users` for customers or `adminEmployees` for employees. If the Firestore write fails, it attempts to delete the Auth user.

Customer records include `full_name`, `email`, `phone_number`, `address`, `uid`, `account_status`, `created_at`, `updated_at`, and `avatar`. Employee records include `name`, `email`, `role`, `uid`, `account_status`, `created_at`, `updated_at`, and `avatar`. New accounts are marked active. See [`create-account.js`](server/src/main/create-account.js#L83) and its record creation/rollback logic (server/src/main/create-account.js#L270).

### Suspend and reactivate

`POST /api/accounts/:id/suspend` disables the Firebase Auth user and then marks the `users` document `account_status: "suspended"`. Reactivation marks the document active, enables the Auth user, and tries to restore suspended status if enabling Auth fails. These are multiple operations, not a transaction; a failure can leave Auth and Firestore status inconsistent. See [`account-actions.js`](server/src/main/account-actions.js#L7).

The client login maps Firebase `auth/user-disabled` to an “Account suspended” dialog: [`Login.tsx`](client/src/components/auth/Login.tsx#L74) and [`Login.tsx` dialog](client/src/components/auth/Login.tsx#L320).

### Express authorization and UI limits

Protected Express endpoints use a Firebase ID token in `Authorization: Bearer <token>`. Middleware verifies the token with revocation checking, requires verified email, looks up `adminEmployees` by UID, requires `account_status === "active"`, and checks the allowed role. See [`authorization-core.js`](server/src/main/authorization-core.js#L1).

The admin UI AuthContext checks email verification and an admin role but does not check employee `account_status`; server middleware is the enforcement layer for protected API calls. Direct Firestore and Storage operations rely on Firebase rules, which were not available locally.

The suspension route does not explicitly call `revokeRefreshTokens`. The local source supports blocking future logins for disabled accounts, but does not alone establish that an already-open client session is immediately terminated. That depends on Firebase Auth token behavior and deployed rules/runtime behavior.

## 7. Main algorithms and examples

### Room detection and area

`buildRegionGraph` creates two directed half-edges per wall and sorts outgoing edges at each corner by angle in the X/Z plane. `walkRegions` follows adjacent half-edges around corners to trace faces. `solveRegions` filters polygons with area at or below `0.01`, removes redundant composite boundaries, determines adjacency/containment, and represents contained child boundaries as holes. See [`RegionGraph`](client/src/engine/regions/RegionGraph.ts#L5), [`RegionWalker`](client/src/engine/regions/RegionWalker.ts#L48), and [`RegionSolver`](client/src/engine/regions/RegionSolver.ts#L14).

Polygon area is computed using the shoelace formula on X/Z coordinates, treated by the application as metres. A 4 m by 3 m rectangle therefore has area 12 m². Flooring cost subtracts hole-loop areas and clamps the result at zero. See [`polygonArea`](client/src/engine/regions/Polygon.ts#L36) and [`calculateRegionFloorArea`](client/src/engine/cost/FlooringCostCalculator.ts#L43).

### Flooring costs

For a per-piece tile price:

`pieces = ceil(room area / (tile length × tile width))`

An epsilon tolerance avoids rounding a near-integer quotient upward due only to floating-point representation. Example: a 12 m² room with 0.6 m × 0.6 m tiles needs `ceil(12 / 0.36) = 34` pieces. At PHP 45 per tile, the estimated tile cost is PHP 1,530. See [`calculateFlooringPieceCost`](client/src/engine/cost/FlooringPieceCalculation.ts#L8).

Legacy materials can use a price per square metre. If legacy dimensions are present, the calculator derives per-piece area and price; without dimensions, it estimates `area × rate`. The estimate does not include waste or installation labor. See [`calculateFlooringCosts`](client/src/engine/cost/FlooringCostCalculator.ts#L88).

### Wall finishes

For each finished wall face, gross area is `wall length × wall height`. Door, window, and opening cutouts are subtracted. Rectangular cutouts are combined with a rectangle-union algorithm, so overlapping rectangles are not subtracted twice. Arch area is approximated as a rectangle plus semicircle. See [`calculateRectangleUnionArea`](client/src/engine/cost/WallFinishCostCalculator.ts#L81), [`calculateArchArea`](client/src/engine/cost/WallFinishCostCalculator.ts#L147), and [`calculateWallFinishCosts`](client/src/engine/cost/WallFinishCostCalculator.ts#L173).

Example: a 4 m wall at 2.7 m high has 10.8 m² gross area. A 0.9 m × 2.1 m door removes 1.89 m², leaving 8.91 m². At PHP 85/m², the topcoat item is PHP 757.35 for that face. Primer is based on total painted area divided by 10 m²/L, rounded up, at PHP 160/L.

The item records two topcoat coats, but the topcoat subtotal is not multiplied by two in the inspected calculator. Whether the material rate is meant to cover both coats is not established by source. Arch calculation does not use `archRise`; arch cutouts are added separately from rectangular union area, so overlapping arch and rectangular cutouts may be double-subtracted. The estimate does not include labor, ceiling paint, or other construction costs.

### Estimate aggregation

`calculateCostEstimate` combines furniture, flooring, wall finish, doors, and windows, then sums item subtotals. See [`calculateCostEstimate`](client/src/engine/cost/CostEstimator.ts#L30). Furniture, doors, and windows are grouped by asset ID. Furniture without a known asset/price is skipped; door/window price defaults to zero. See [`FurnitureCostCalculator`](client/src/engine/cost/FurnitureCostCalculator.ts#L20), [`DoorCostCalculator`](client/src/engine/cost/DoorCostCalculator.ts), and [`WindowCostCalculator`](client/src/engine/cost/WindowCostCalculator.ts).

This is a client-side material estimate, not a complete construction quotation. Taxes, labor, delivery, and a general waste allowance are not included in the aggregation.

## 8. Express API reference

Protected routes require `Authorization: Bearer <Firebase ID token>`. The middleware responds with 401 for missing or invalid credentials, 403 for unverified or unauthorized accounts, and 500 if role lookup fails. CORS origins and route mounts are configured in [`server.js`](server/src/main/server.js#L1).

| Method and route | Access | Inputs and validation | Data operations, responses, side effects |
|---|---|---|---|
| `GET /api/health` | No auth | No body | 200 JSON `{ success, message }`; no data writes. |
| `POST /api/accounts` | `superadmin` | JSON account type, name, email, password; employee role must be `admin` or `superadmin`; optional customer phone/address | 400 validation error, 201 success, or 500 failure. Creates Firebase Auth user and `users`/`adminEmployees` document; attempts Auth rollback if Firestore creation fails. [`create-account.js`](server/src/main/create-account.js#L83) |
| `POST /api/accounts/:id/suspend` | `superadmin` | `id` is the user document ID | 400 missing ID, 404 missing user, 200 success, or 500 failure. Disables Auth then updates user status. [`account-actions.js`](server/src/main/account-actions.js#L7) |
| `POST /api/accounts/:id/reactivate` | `superadmin` | `id` is the user document ID | 400/404/200/500. Updates status, enables Auth, attempts status rollback on Auth failure. [`account-actions.js`](server/src/main/account-actions.js#L57) |
| `POST /api/assets` | `superadmin` | Multipart fields: `asset_type`, `name`, `category`, status, price/`pricePerPiece`; floor `length`/`width` in metres; optional files `modelFile`, `diffuseFile`, `normalFile`, `roughnessFile`, `aoFile`; optional color/material settings | 400 validation/upload error, 413 file too large, 409 duplicate, 201 success, otherwise error JSON. Writes Storage objects and then an `assets` document; deletes uploaded objects on caught failure. [`create-asset.js`](server/src/main/create-asset.js#L268) |
| `DELETE /api/assets/:id` | `superadmin` | Asset ID path parameter | 400 missing ID, 404 missing asset, 200 success, or 500 failure. Deletes known Storage objects then the Firestore asset record. [`create-asset.js`](server/src/main/create-asset.js#L613) |
| `POST /api/projects/:projectId/comments` | `admin` only | JSON `targetType`, `targetId` (string or null), `targetLabel`, optional `regionId`, nonempty `text` | 400 invalid/missing fields, 201 with `commentId`, or 500 failure. Transaction creates `adminComments` record and updates yearly counter. No notification/activity write. [`project-comments.js`](server/src/main/project-comments.js#L28) |
| `PATCH /api/projects/:projectId/deadline` | `admin` or `superadmin` | JSON body must contain `deadline`: valid `YYYY-MM-DD` or `null` | 400 missing/invalid/past date, 404 missing project, 200 `{ success: true }`, or 500 failure. Updates project `deadline` and `updatedAt`. [`project-deadlines.js`](server/src/main/project-deadlines.js#L11) |

Project save/load, project listing, asset updates, comment reads, and catalog reads use direct Firebase SDK calls; they are not Express endpoints.

## 9. Firebase collections, Storage, and local configuration

Collections evidenced in source:

| Collection | Fields/role observed in code |
|---|---|
| `projects` | `projectId`, `projectName`, `ownerId`, `jsonPath`, `jsonUrl`, thumbnail path/URL, `schemaVersion`, `estimatedCost`, `createdAt`, `updatedAt`, optional `deadline` |
| `users` | Customer profile, Auth `uid`, `account_status`, timestamps |
| `adminEmployees` | `name`, `email`, `role`, Auth `uid`, `account_status`, timestamps |
| `assets` | `id`, `name`, `asset_type`, `category`, `asset_status`, prices, floor dimensions, material settings, Storage paths |
| `systemCounters` | Asset ID sequence values |
| `idCounters` | Project/comment sequence values and year metadata |
| `adminComments` | Comment fields described above |

Storage paths evidenced in source:

- `projects/<uid>/<projectId>.json`
- `projects/<uid>/<projectId>.jpg` (optional thumbnail)
- `assets/<type>/<category>/<assetId>/<role>.<extension>`

Client and admin Firebase initialization identify project ID `espasyo-6072d`: [`client Firebase setup`](client/src/firebase/firebase.ts#L1) and [`admin Firebase setup`](admin/src/firebase/firebase.ts#L1). The server reads a local service-account JSON file in [`firebase-admin.js`](server/src/firebase-admin.js#L1); its contents are intentionally not reproduced here.

The server source references `NODE_ENV`. A separate storage-inventory script references `FIREBASE_STORAGE_BUCKET` and `STORAGE_BUCKET`. I found no Firebase rules files, `firebase.json`, `.firebaserc`, or Cloud Functions source in the local repository. The server package includes a local `dev` script; that is not evidence of production deployment.

## 10. Findings and unverified behavior

### Missing or incomplete connections

- Project save spans Storage and Firestore without rollback; partial/orphaned files are possible.
- No project deletion implementation was found.
- Deadline enforcement is client-side for saves; server-side project write enforcement was not found.
- No reminder scheduler or notification/activity pipeline was found.
- Comments can be created and read, but no reply/status-update flow was found.
- Asset edits are direct Firestore writes, while creation and deletion use Express.
- Asset catalogs are cached in memory and are not real-time subscriptions.
- Asset deletion does not update project references that may contain the deleted asset ID.
- The asset delete sequence can leave a Firestore record pointing to deleted files if the final document deletion fails.
- Furniture asset catalog handling includes unavailable assets; floor, wall, and door/window catalog loaders filter unavailable assets.
- Flooring quantity rounds to whole pieces but does not add waste; overall estimate omits labor and other project costs.
- Wall finish records two coats without multiplying the price subtotal; intended pricing convention needs business confirmation.
- Arch calculation ignores `archRise` and may double-count overlap with other cutouts.

### Requires Firebase or deployment verification

- Actual Firestore/Storage rules and direct-operation permissions.
- Whether production has scheduled functions or external reminder jobs not present in this repository.
- Production service-account availability and API deployment configuration.
- Runtime behavior for an already-authenticated user after account suspension.
- Whether public/direct Storage URLs and cached copies remain available according to deployed policy.

No tests, builds, live Firebase operations, or deployment checks were performed for this report. Source evidence should not be treated as proof of production configuration or behavior.