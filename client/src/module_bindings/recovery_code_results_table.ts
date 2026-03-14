// Private table — hand-written because spacetimedb codegen skips private tables.
// DO NOT DELETE — required for AccountPage to subscribe to recovery_code_results (SEC-03).
// If you run `make generate`, re-add this file and the entry in index.ts manually.

/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";

export default __t.row({
  owner: __t.identity().primaryKey(),
  code: __t.string(),
});
