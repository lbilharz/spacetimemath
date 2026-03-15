// Hand-written binding for private table restore_results (ACCT-03).
// codegen skips private tables — follow recovery_code_results_table.ts pattern.
/* eslint-disable */
/* tslint:disable */
import {
  TypeBuilder as __TypeBuilder,
  t as __t,
  type AlgebraicTypeType as __AlgebraicTypeType,
  type Infer as __Infer,
} from "spacetimedb";

export default __t.row({
  caller: __t.identity().primaryKey(),
  token: __t.string(),
});
