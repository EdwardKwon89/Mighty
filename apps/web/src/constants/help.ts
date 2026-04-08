export const HELP_CONTENT = {
  basic: {
    title: "기본 규칙",
    items: [
      {
        label: "마이티 (Mighty)",
        desc: "최강의 카드. 보통 S14이나 기루다가 스페이드면 D14가 마이티가 됩니다."
      },
      {
        label: "조커 (Joker)",
        desc: "마이티를 제외한 모든 카드를 승리. 첫/마지막 트릭에서는 힘을 잃습니다."
      },
      {
        label: "조커 콜 (Joker Call)",
        desc: "C3를 내며 선언. 해당 트릭의 조커효과 무효화."
      }
    ]
  },
  bidding: {
    title: "비딩 (Bidding)",
    items: [
      {
        label: "최소 장수",
        desc: "13장부터 시작합니다."
      },
      {
        label: "무늬 변경 (+1)",
        desc: "히든카드를 보기 전에는 무늬 변경 시 +1장 이상 필요합니다."
      },
      {
        label: "무늬 변경 (+2)",
        desc: "주공이 히든카드를 본 후 무늬를 변경하려면 반드시 +2장 이상 필요합니다."
      }
    ]
  },
  settlement: {
    title: "정산 (Settlement)",
    items: [
      {
        label: "노카드 (No Trump)",
        desc: "기루다 없는 게임. 모든 정산 포인트 2배 적용."
      },
      {
        label: "노프렌드 (Solo)",
        desc: "혼자서 야당을 상대. 모든 정산 포인트 2배 적용."
      },
      {
        label: "최대 배수",
        desc: "노카드 + 노프렌드 조합 시 최종 4배 포인트가 정산됩니다."
      }
    ]
  }
};
