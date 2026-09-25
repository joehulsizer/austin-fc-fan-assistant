"""Materialize the fixed 120-question acceptance set. Run only when editing cases."""
import json
from pathlib import Path

groups = [
    ("vegan", "concessions", ["119"], "q2stadium.com", [
        "I'm in section 123. Where can I get vegan food?", "Vegan options near section 123?",
        "Anything vegab by section 123?", "section 123 vegan food please", "Where is Verde Vegan from section 123?",
        "¿Comida vegana cerca de la sección 123?", "Estoy en sección 123, ¿hay comida vegana?",
        "Vegan at section 119?", "Is there vegan food near section 125?", "I sit in sectoin 123, need vegan food",
    ]),
    ("vegetarian", "concessions", ["122"], "q2stadium.com", [
        "Vegetarian food near section 123?", "Where are vegetarian tacos?", "I'm in section 122 and vegetarian",
        "¿Dónde puedo encontrar comida vegetariana?", "Comida vegetariana en sección 123",
        "Any vegetarian food at Q2?", "What can a vegetarian eat near section 121?",
        "vegetarian options at section 124", "Are there veggie options?", "I want vegetarian concessions",
    ]),
    ("gluten", "concessions", ["gluten"], "q2stadium.com", [
        "Gluten free food at Q2?", "Gluten-aware options near section 123?", "Can you guarantee allergy-safe gluten free food?",
        "Is there food avoiding gluten?", "What gluten options are published?", "Sin gluten cerca de sección 123",
        "Soy celíaco, ¿dónde puedo comer?", "Gluten free nachos?", "What about celiac-safe meals?",
        "I need gluten aware food",
    ]),
    ("drinks", "drinks", ["Bar"], "q2stadium.com", [
        "What about drinks?", "Beer near section 123?", "Where can I get a drink in section 123?",
        "Wine bar at Q2?", "Any beer by section 120?", "¿Dónde hay cerveza cerca de la sección 123?",
        "Bebidas en sección 125", "I want a soda near 123", "Is there a bar near section 125?",
        "Where is the YETI Bar?",
    ]),
    ("diaper", "stadium", ["bag"], "q2stadium.com", [
        "Can I bring a diaper bag?", "Are diaper bags allowed?", "May I enter with a childcare bag?",
        "Diaper bag policy please", "I'm with a baby; can I bring a diaper bag?",
        "¿Puedo llevar una bolsa de pañales?", "¿Permiten una pañalera?", "Do you screen childcare bags?",
        "What if I bring a diaper bag with my kid?", "Is a diaper bag a bag-policy exception?",
    ]),
    ("train", "transport", ["McKalla"], "q2stadium.com", [
        "How do I get to the stadium by train?", "Which rail stop serves Q2?", "Train to Austin FC?",
        "Does the Red Line go to the stadium?", "Where is McKalla Station?",
        "¿Cómo llego en tren a Q2 Stadium?", "¿Qué estación de tren uso?", "Can I take CapMetro rail?",
        "Public transit by train please", "Is there a rail station east of Q2?",
    ]),
    ("transfer", "ticketing", ["app"], "q2stadium.com", [
        "How do I transfer my ticket?", "Can I transfer a ticket on SeatGeek?", "Ticket transfer instructions",
        "Where do I send my digital ticket?", "How can the recipient get my ticket?",
        "¿Cómo puedo transferir mi boleto?", "Transferir entrada desde la app", "My ticket transfer button is missing",
        "Can I share my Austin FC ticket?", "Help me transfer tickets to a friend",
    ]),
    ("purchase", "transaction", ["ticket"], "austinfc.com", [
        "Can you buy the ticket for me?", "Purchase a ticket for me", "Book my match ticket",
        "Buy two tickets right now", "Can you sell me a ticket?", "Compra un boleto por mí",
        "¿Puedes comprarme las entradas?", "Please buy me a ticket", "Buy my game tickets",
        "Can you purchase Austin FC tickets for us?",
    ]),
    ("sensory", "stadium", ["125"], "q2stadium.com", [
        "Where is the sensory room?", "Do you have a sensory room?", "Sensory space for my child?",
        "Need a quiet sensory room", "Which section is the sensory room behind?",
        "¿Dónde está la sala sensorial?", "¿Hay espacio sensorial?", "Can I get a sensory kit?",
        "Where do I go for sensory support?", "Sensory room near section 125?",
    ]),
    ("water", "stadium", ["30"], "q2stadium.com", [
        "Where can I refill my water bottle?", "Can I bring an empty water bottle?", "Water stations at Q2?",
        "Where are YETI hydration stations?", "Can I take a 30 ounce empty bottle?",
        "¿Puedo traer una botella vacía de agua?", "¿Dónde puedo rellenar mi botella?",
        "Hydration station near northwest corner?", "Are sealed water bottles allowed?",
        "What is the refill policy for water?",
    ]),
    ("weather", "weather", ["match"], "weather.gov", [
        "Will it rain at kickoff?", "Weather at kickoff?", "What's the forecast for kickoff?",
        "Is it hot at kickoff?", "Need rain forecast at kickoff", "¿Lloverá al inicio del partido?",
        "Clima a la hora de inicio del partido", "Forecast for match kickoff?",
        "Will I need a raincoat at kickoff?", "Temperature at kickoff?",
    ]),
    ("next_match", "club", ["San Diego"], "austinfc.com", [
        "When is the next Austin FC home match?", "Who do we play next at Q2?", "Next home game?",
        "What time is the next home match?", "When do Austin FC play next at home?",
        "¿Cuándo es el próximo partido en casa?", "¿Quién es el rival del siguiente partido en casa?",
        "Next match at Q2 Stadium?", "Is the next home game against San Diego?",
        "Tell me the next Austin FC home match and kickoff",
    ]),
]
patterns = {"vegan": r"119", "vegetarian": r"122", "gluten": r"gluten|cel[ií]ac", "drinks": r"bar",
            "diaper": r"bag|bolsa|pañalera", "train": r"McKalla", "transfer": r"app", "purchase": r"ticket|boleto|entrada",
            "sensory": r"125", "water": r"30", "weather": r"match|partido", "next_match": r"San Diego"}
cases = [{"id": f"{kind}-{i+1:02d}", "kind": kind, "question": prompt, "route": route,
          "mustMatch": patterns[kind], "sourceDomain": source}
         for kind, route, needles, source, prompts in groups for i, prompt in enumerate(prompts)]
assert len(cases) == 120 and len(set(x["question"] for x in cases)) == 120
out = Path(__file__).resolve().parents[1] / "data" / "evaluation.json"
out.write_text(json.dumps(cases, ensure_ascii=False, indent=2) + "\n")
print(f"Wrote {len(cases)} fixed evaluation cases")
