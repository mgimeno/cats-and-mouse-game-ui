import { animate, state, style, transition, trigger } from "@angular/animations";

export enum DrawAttentionAnimationStateEnum {
  'Initial' = 'Initial',
  'MyTurn' = 'MyTurn',
  'TheirTurn' = 'TheirTurn',
  'IWon' = 'IWon',
  'ILost' = 'ILost',
}

export const DrawAttentionAnimation = trigger('DrawAttentionAnimation', [
  state(DrawAttentionAnimationStateEnum.Initial, style({'font-size': '30px'})),
  state(DrawAttentionAnimationStateEnum.MyTurn, style({'font-size': '32px'})),
  state(DrawAttentionAnimationStateEnum.TheirTurn, style({'font-size': '28px'})),
  state(DrawAttentionAnimationStateEnum.IWon, style({'font-size': '40px'})),
  state(DrawAttentionAnimationStateEnum.ILost, style({'font-size': '40px'})),
  transition('* => *', animate('400ms'))
]);

