import {test} from 'node:test';
import assert from 'node:assert/strict';
import {notificationText} from '../src/lib/notification-text';
test('notification editor text becomes readable paragraphs',()=>{
  assert.equal(notificationText(JSON.stringify({time:1,blocks:[{type:'paragraph',data:{text:'&nbsp; Мамам <b>объятия</b> &mdash; &#10084;'}},{type:'paragraph',data:{text:'Заказывайте<br>в приложении'}}],version:'2.29.1'})), 'Мамам объятия — ❤\n\nЗаказывайте\nв приложении');
  assert.equal(notificationText({blocks:[{type:'list',data:{items:['Первое',{content:'Второе'}]}}]}),'Первое\nВторое');
});
test('plain text survives and malformed editor data is not exposed',()=>{
  assert.equal(notificationText('Ваш заказ готов'), 'Ваш заказ готов');
  assert.equal(notificationText('{"blocks":invalid'), '');
  assert.equal(notificationText({version:'2',blocks:[{type:'unknown',data:{text:'ignore'}}]}),'');
  assert.equal(notificationText('&#999999999;'), '');
  assert.equal(notificationText('&lt;img src=x onerror=alert(1)&gt;'),'<img src=x onerror=alert(1)>');
});
