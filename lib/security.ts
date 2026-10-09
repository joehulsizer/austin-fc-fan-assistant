import {normalized} from './safety';

/** Shared recognition for chat refusals and rejecting poisoned knowledge text. */
export function isInstructionAttack(value:string):boolean {
  return /system prompt|developer (?:message|prompt)|ignore (?:all|previous|your)|print (?:your|the) (?:instructions|prompt)|api key|secret token|reveal (?:your|the)|ignora.{0,40}(?:instrucciones|reglas)|(?:prompt|instrucciones|mensaje) (?:del sistema|ocultas|del desarrollador)|claves? (?:api|privadas?|secretas?)|revela.{0,25}credenciales|revela.{0,35}(?:mensaje|clave|instrucciones)|pretend you are ticket hq/.test(normalized(value));
}
