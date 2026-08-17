/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessRequests from "../accessRequests.js";
import type * as billing from "../billing.js";
import type * as clients from "../clients.js";
import type * as content from "../content.js";
import type * as crons from "../crons.js";
import type * as demo from "../demo.js";
import type * as email from "../email.js";
import type * as http from "../http.js";
import type * as managerAccess from "../managerAccess.js";
import type * as members from "../members.js";
import type * as migrations from "../migrations.js";
import type * as model_auth from "../model/auth.js";
import type * as model_plans from "../model/plans.js";
import type * as model_rateLimit from "../model/rateLimit.js";
import type * as model_trialNotices from "../model/trialNotices.js";
import type * as model_workspaces from "../model/workspaces.js";
import type * as portfolio from "../portfolio.js";
import type * as reports from "../reports.js";
import type * as sync from "../sync.js";
import type * as trials from "../trials.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessRequests: typeof accessRequests;
  billing: typeof billing;
  clients: typeof clients;
  content: typeof content;
  crons: typeof crons;
  demo: typeof demo;
  email: typeof email;
  http: typeof http;
  managerAccess: typeof managerAccess;
  members: typeof members;
  migrations: typeof migrations;
  "model/auth": typeof model_auth;
  "model/plans": typeof model_plans;
  "model/rateLimit": typeof model_rateLimit;
  "model/trialNotices": typeof model_trialNotices;
  "model/workspaces": typeof model_workspaces;
  portfolio: typeof portfolio;
  reports: typeof reports;
  sync: typeof sync;
  trials: typeof trials;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
