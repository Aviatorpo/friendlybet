const FIXTURE = {
  seedVersion: 'qa-staging-v1',
  pool: {
    id: '11111111-1111-4111-8111-111111111111',
    code: 'QA26X',
    name: 'FriendlyBet QA Pool',
    language: 'he',
    tournament: 'wc2026',
    status: 'open',
    betting_mode: 'single_phase',
    use_multipliers: true,
    scoring_rules: {
      group_first: 4,
      group_second: 3,
      group_third: 2,
      group_fourth: 1,
      round_of_32: 2,
      round_of_16: 4,
      quarter_final: 8,
      semi_final: 16,
      final: 32,
      third_place_advance: 1,
      top_scorer: 10,
      multipliers: {
        favorite: 1.0,
        contender: 1.5,
        underdog: 2.0
      },
      team_multipliers: {}
    }
  },
  users: [
    {
      id: '22222222-2222-4222-8222-222222222221',
      nickname: 'Eyal QA',
      is_admin: true,
      recovery_code: 'EYAL-QA26-0001-TEST',
      pick: 'MEX',
      expected_total_score: 2
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      nickname: 'Dana QA',
      is_admin: false,
      recovery_code: 'DANA-QA26-0002-TEST',
      pick: 'RSA',
      expected_total_score: 0
    },
    {
      id: '22222222-2222-4222-8222-222222222223',
      nickname: 'Noa QA',
      is_admin: false,
      recovery_code: 'NOAQ-QA26-0003-TEST',
      pick: 'MEX',
      expected_total_score: 2
    },
    {
      id: '22222222-2222-4222-8222-222222222224',
      nickname: 'Amir QA',
      is_admin: false,
      recovery_code: 'AMIR-QA26-0004-TEST',
      pick: 'RSA',
      expected_total_score: 0
    },
    {
      id: '22222222-2222-4222-8222-222222222225',
      nickname: 'Maya QA',
      is_admin: false,
      recovery_code: 'MAYA-QA26-0005-TEST',
      pick: 'MEX',
      expected_total_score: 2
    },
    {
      id: '22222222-2222-4222-8222-222222222226',
      nickname: 'Roni QA',
      is_admin: false,
      recovery_code: 'RONI-QA26-0006-TEST',
      pick: 'RSA',
      expected_total_score: 0
    },
    {
      id: '22222222-2222-4222-8222-222222222227',
      nickname: 'Lior QA',
      is_admin: false,
      recovery_code: 'LIOR-QA26-0007-TEST',
      pick: 'MEX',
      expected_total_score: 2
    },
    {
      id: '22222222-2222-4222-8222-222222222228',
      nickname: 'Shira QA',
      is_admin: false,
      recovery_code: 'SHIR-QA26-0008-TEST',
      pick: 'RSA',
      expected_total_score: 0
    },
    {
      id: '22222222-2222-4222-8222-222222222229',
      nickname: 'Omer QA',
      is_admin: false,
      recovery_code: 'OMER-QA26-0009-TEST',
      pick: 'MEX',
      expected_total_score: 2
    },
    {
      id: '22222222-2222-4222-8222-222222222230',
      nickname: 'Tal QA',
      is_admin: false,
      recovery_code: 'TALQ-QA26-0010-TEST',
      pick: 'RSA',
      expected_total_score: 0
    }
  ],
  teams: [
    { code: 'MEX', name_en: 'Mexico', name_he: 'Mexico', group_letter: 'A', tier: 'contender', fifa_ranking: 18, flag_emoji: null },
    { code: 'RSA', name_en: 'South Africa', name_he: 'South Africa', group_letter: 'A', tier: 'underdog', fifa_ranking: 49, flag_emoji: null }
  ],
  match: {
    id: '33333333-3333-4333-8333-333333333333',
    external_id: 'qa-r32-001',
    stage: 'ROUND_OF_32',
    home_team_code: 'MEX',
    away_team_code: 'RSA',
    home_team_name: 'Mexico',
    away_team_name: 'South Africa',
    venue: 'QA Stadium',
    result: { home_score: 2, away_score: 1, winner: 'MEX' }
  }
};

module.exports = FIXTURE;
