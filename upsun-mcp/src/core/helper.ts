import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export class Schema {

  static activityId(): z.ZodString {
    return z.string();
  }

  static projectId(): z.ZodString {
    return z.string().length(13, "Project ID must be 13 characters long");
  }

  static environmentName(): z.ZodString {
    return z.string();
  }

  static applicationName(): z.ZodString {
    return z.string();
  }

  static organizationId(): z.ZodString {
    return z.string().length(27, "Organization ID must be 27 characters long");
  }

  static organizationName(): z.ZodString {
    return z.string();
  }

  static backupId(): z.ZodString {
    return z.string().length(27, "Backup ID must be 27 characters long");
  }

  static certificateId(): z.ZodString {
    return z.string().length(65, "Certificate ID must be 65 characters long");
  }

  static domainName(): z.ZodString {
    return z.string().max(255, "Domain name must be less than 255 characters");
  }
}

export class Assert {
  static projectId(id: string): boolean {
    return true;
  }

  static environmentName(name: string): boolean {
    return true;
  }
}

export class Response {
  static text(text: string): CallToolResult {
    return {
      content: [{
        type: "text",
        text: text
      }]
    };
  }

  static json(json: any): CallToolResult {
    return {
      content: [{
        type: "text",
        text: JSON.stringify(json, null, 2)
      }]
    };
  }
}
