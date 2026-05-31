'use strict';

// Fake Discord snowflake IDs — valid format nhưng không thể là user/guild thật
// (snowflake năm 2015, trước khi Discord ra mắt public)
const FAKE_USER_ID   = '100000000000000001';
const FAKE_USER_ID_2 = '100000000000000002';

const TEST_PREFIX       = '__TEST__';
const TEST_SESSION_NAME = '__TEST__session';
const TEST_SCHED_NAME   = '__TEST__lich_co_dinh';
const TEST_BADGE_THRESH = 9999; // threshold vô lý, không thể trùng thật
const TEST_CONFIG_KEY   = '__test_ping__';

module.exports = {
  FAKE_USER_ID,
  FAKE_USER_ID_2,
  TEST_PREFIX,
  TEST_SESSION_NAME,
  TEST_SCHED_NAME,
  TEST_BADGE_THRESH,
  TEST_CONFIG_KEY,
};
