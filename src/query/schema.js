"use strict";

const resources = {
  events: {
    resource: "event",
    table: "events",
    idField: "id",
    fields: {
      id: { column: "id", public: true },
      title: { column: "title", public: true },
      category: { column: "category", public: true },
      startDate: { column: "start_date", fieldGroup: "event:private_details" },
      endDate: { column: "end_date", fieldGroup: "event:private_details" },
      dateLabel: { column: "date_label", public: true },
      homeBase: { column: "home_base", fieldGroup: "event:private_details" },
      location: { column: "location", fieldGroup: "event:private_details" },
      audience: { column: "audience", public: true },
      description: { column: "description", public: true },
      detailNote: { column: "detail_note", public: true },
      registrationRequired: { column: "registration_required", fieldGroup: "event:private_details" },
      upcoming: { column: "upcoming", public: true },
      repeatEnabled: { column: "repeat_enabled", public: true },
      repeatFrequency: { column: "repeat_frequency", public: true },
      repeatInterval: { column: "repeat_interval", public: true },
      repeatUntil: { column: "repeat_until", public: true },
      repeatMonthlyPattern: { column: "repeat_monthly_pattern", public: true },
      repeatMonthlyOrdinal: { column: "repeat_monthly_ordinal", public: true },
      repeatMonthlyWeekday: { column: "repeat_monthly_weekday", public: true },
    },
  },
  scouts: {
    resource: "scout",
    table: "scouts",
    idField: "id",
    fields: {
      id: { column: "id", public: true },
      name: { column: "name", public: true },
      firstName: { column: "first_name", public: true },
      lastName: { column: "last_name", public: true },
      nickname: { column: "nickname", public: true },
      gender: { column: "gender", public: true },
      patrol: { column: "patrol", public: true },
      patrolBadge: { column: "patrol_badge", public: true },
      rank: { column: "rank", public: true },
      leadershipRole: { column: "leadership_role", public: true },
      avatar: { column: "avatar", public: true },
    },
  },
  adults: {
    resource: "person",
    table: "adults",
    idField: "id",
    fields: {
      id: { column: "id", public: true },
      name: { column: "name", public: true },
      relationship: { column: "relationship", public: true },
      email: { column: "email", fieldGroup: "person:contact_details" },
      homePhone: { column: "home_phone", fieldGroup: "person:contact_details" },
      cellPhone: { column: "cell_phone", fieldGroup: "person:contact_details" },
    },
  },
};

function getResourceSchema(resource) {
  return resources[resource] || null;
}

module.exports = {
  resources,
  getResourceSchema,
};
