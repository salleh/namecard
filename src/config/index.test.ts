// @vitest-environment node
import { describe, expect, it } from "vitest";
import { orgConfig } from "../../customization/org";
import * as config from "./index";

describe("config barrel", () => {
  it("re-exports the company defaults", () => {
    expect(config.COMPANY_DEFAULTS.company).toBe(orgConfig.orgLegalName);
  });

  it("re-exports the env parser", () => {
    expect(typeof config.parseEnv).toBe("function");
  });

  it("re-exports the validated org config", () => {
    expect(config.org.appName).toBe(orgConfig.appName);
  });
});
