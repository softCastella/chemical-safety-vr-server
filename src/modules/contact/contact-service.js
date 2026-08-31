import { randomUUID } from "node:crypto";

import { AppError, badRequest } from "../../lib/app-error.js";

const allowedFields = new Set([
  "name",
  "email",
  "inquiryType",
  "message",
  "website",
]);
const inquiryTypeLabels = Object.freeze({
  general: "일반 문의",
  business: "비즈니스 문의",
});

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest("요청 본문은 JSON 객체여야 합니다.");
  }
}

function rejectUnknownFields(payload) {
  const unknownFields = Object.keys(payload).filter(
    (field) => !allowedFields.has(field),
  );
  if (unknownFields.length > 0) {
    throw badRequest("지원하지 않는 입력 항목이 포함되어 있습니다.", {
      fields: unknownFields,
    });
  }
}

function readString(payload, name, { minimum = 1, maximum }) {
  const value = payload[name];
  if (typeof value !== "string") {
    throw badRequest(`${name} 항목을 문자열로 입력해주세요.`);
  }

  const normalized = value.trim();
  if (normalized.length < minimum || normalized.length > maximum) {
    throw badRequest(
      `${name} 항목은 ${minimum}자 이상 ${maximum}자 이하로 입력해주세요.`,
    );
  }
  return normalized;
}

function readName(payload) {
  const name = readString(payload, "name", { maximum: 100 });
  if (/\r|\n/.test(name)) {
    throw badRequest("이름에는 줄바꿈을 사용할 수 없습니다.");
  }
  return name;
}

function readEmail(payload) {
  const email = readString(payload, "email", { maximum: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw badRequest("올바른 이메일 주소를 입력해주세요.");
  }
  return email;
}

function readInquiryType(payload) {
  if (!Object.hasOwn(inquiryTypeLabels, payload.inquiryType)) {
    throw badRequest("문의 종류를 선택해주세요.");
  }
  return payload.inquiryType;
}

function hasHoneypotValue(payload) {
  return typeof payload.website === "string" && payload.website.trim() !== "";
}

export function createContactService({ mailer, idFactory = randomUUID }) {
  return {
    async submit(payload) {
      requireObject(payload);
      rejectUnknownFields(payload);

      if (hasHoneypotValue(payload)) {
        return { accepted: true, ignored: true };
      }

      const submission = {
        id: idFactory(),
        name: readName(payload),
        email: readEmail(payload),
        inquiryType: readInquiryType(payload),
        inquiryTypeLabel: inquiryTypeLabels[payload.inquiryType],
        message: readString(payload, "message", {
          minimum: 10,
          maximum: 5000,
        }),
      };

      try {
        await mailer.send(submission);
      } catch (error) {
        console.error("Resend contact delivery failed.", {
          code: error?.code ?? "UNKNOWN",
          statusCode: error?.statusCode ?? null,
        });
        throw new AppError(
          502,
          "CONTACT_DELIVERY_FAILED",
          "문의 메일을 전송하지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
      }

      return { accepted: true, id: submission.id };
    },
  };
}
