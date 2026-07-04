# Build Plan

This plan targets a practical hackathon MVP before the Flare Summer Signal submission deadline.

## Phase 1: Documentation and Scope

Target dates:

```text
2026-07-04 to 2026-07-06
```

Deliverables:

- Update README for Flare positioning
- Write product requirements
- Write architecture document
- Write API draft
- Define demo script

Exit criteria:

- A judge can understand the project from GitHub without a live demo
- The MVP scope is small enough to build

## Phase 2: Backend Skeleton

Target dates:

```text
2026-07-07 to 2026-07-13
```

Deliverables:

- Go API project
- Service request endpoint
- Payment intent endpoint
- In-memory or SQLite persistence
- Ledger model
- Webhook event model

Exit criteria:

- Local API can create a service request
- Local API can create and fetch a payment intent
- Local API can create a ledger entry after a mock confirmation

## Phase 3: Flare Coston2 Integration

Target dates:

```text
2026-07-14 to 2026-07-24
```

Deliverables:

- Minimal Solidity payment contract
- Hardhat or Foundry deployment setup
- Flare Coston2 deployment notes
- PaymentRecorded event
- Backend event listener or transaction confirmation workflow

Exit criteria:

- A testnet transaction can be linked to a payment intent
- The backend can mark a payment intent as paid
- The transaction hash is visible in the demo

## Phase 4: Webhook and AI Summary

Target dates:

```text
2026-07-25 to 2026-08-02
```

Deliverables:

- Signed webhook payload
- Mock paid service receiver
- Delivery status tracking
- Simple retry behavior
- AI payment summary endpoint

Exit criteria:

- Paid payment intent triggers a webhook
- Webhook payload includes signature metadata
- AI summary explains the payment status

## Phase 5: Demo UI and Polish

Target dates:

```text
2026-08-03 to 2026-08-10
```

Deliverables:

- Minimal web UI or API demo page
- Clear README run instructions
- Screenshots
- Architecture diagram
- Public demo video draft

Exit criteria:

- Demo can be completed in under 3 minutes
- README has setup and demo instructions
- All core flow steps are visible

## Phase 6: Submission

Target dates:

```text
2026-08-11 to 2026-08-14
```

Deliverables:

- Final README
- Demo video
- DoraHacks submission text
- Contract address and deployment details, if available
- Short roadmap

Exit criteria:

- GitHub repository is public
- Demo video is public
- Submission form is complete
- Project story clearly matches Flare Summer Signal

## Risk Control

If time becomes tight, keep these features:

- Payment intent API
- Minimal Flare testnet payment event
- Ledger entry
- Signed webhook
- Demo video

Cut these features first:

- Complex UI
- Multi-asset support
- Production database setup
- Advanced AI agent autonomy
- Flare-native data integrations
