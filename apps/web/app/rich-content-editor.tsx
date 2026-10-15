'use client';
import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Heading2, List, Link2, Smile, X } from 'lucide-react';
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function inline(text:string):string{
 // Escape all source HTML before creating the small supported formatting vocabulary.
 return escape(text).replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" rel="noopener noreferrer">$1</a>').replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_\n]+)__/g,'<strong>$1</strong>').replace(/(^|[\s>])_([^_\n]+)_(?=$|[\s<.,!؟،])/g,'$1<em>$2</em>').replace(/(^|[\s>])\*([^*\n]+)\*(?=$|[\s<.,!؟،])/g,'$1<em>$2</em>');
}
export function contentHtml(text:string):string{
 if(!text)return '';
 let list=false;let html='';
 for(const line of text.split('\n')){
  const item=line.match(/^\s*[-*•] (.*)$/);
  if(item){if(!list){html+='<ul>';list=true;}html+='<li>'+inline(item[1])+'</li>';continue;}
  if(list){html+='</ul>';list=false;}
  const heading=line.match(/^#{1,3} (.*)$/);
  html+=heading?'<h2>'+inline(heading[1])+'</h2>':'<div>'+ (inline(line)||'<br>')+'</div>';
 }
 return html+(list?'</ul>':'');
}
export function ContentPreview({value}:{value:string}){return <div className="rich-content-preview" dangerouslySetInnerHTML={{__html:contentHtml(value)}}/>;}
function markdown(root:HTMLElement):string{
 function walk(node:Node):string{
  if(node.nodeType===Node.TEXT_NODE)return node.textContent||'';
  if(!(node instanceof HTMLElement))return '';
  const tag=node.tagName;
  if(['SCRIPT','STYLE','IFRAME','OBJECT'].includes(tag))return '';
  const inside=Array.from(node.childNodes).map(walk).join('');
  if(tag==='BR')return '\n';
  if(tag==='B'||tag==='STRONG')return inside?'**'+inside+'**':'';
  if(tag==='I'||tag==='EM')return inside?'_'+inside+'_':'';
  if(tag==='A'){const href=node.getAttribute('href')||'';return /^https?:\/\//i.test(href)?'['+inside+']('+href+')':inside;}
  if(/^H[1-6]$/.test(tag))return '## '+inside.trim()+'\n';
  if(tag==='LI')return '• '+inside.replace(/\n+$/,'')+'\n';
  if(['DIV','P','UL','OL'].includes(tag))return inside.replace(/\n$/,'')+'\n';
  return inside;
 }
 return Array.from(root.childNodes).map(walk).join('').replace(/\n$/,'');
}
const emojis=[{title:'احساسات',items:['😀','😊','😍','🥰','😎','🤔','😅','😂','🥳','🤩','🙏','👍','👏','🙌','💪','🤝']},{title:'محتوا و کسب‌وکار',items:['✨','🔥','⭐','💡','🎯','🚀','📌','✅','🎉','🎁','💰','📣','📚','📝','📊','💬']},{title:'نشانه‌ها',items:['❤️','💜','💚','💙','👇','👈','👉','⬅️','➡️','❓','❗','⚠️','📅','⏰','🔗','🌱']}];
export default function RichContentEditor({value,onChange,disabled}:{value:string;onChange:(value:string)=>void;disabled:boolean}){
 const root=useRef<HTMLDivElement>(null),selection=useRef<Range|null>(null),last=useRef<string|null>(null),popover=useRef<HTMLDivElement>(null),emojiButton=useRef<HTMLButtonElement>(null);
 const [picker,setPicker]=useState(false),[link,setLink]=useState(false),[url,setUrl]=useState(''),[linkError,setLinkError]=useState('');
 const [active,setActive]=useState({bold:false,italic:false,heading:false,list:false});
 useEffect(()=>{if(root.current&&last.current!==value){root.current.innerHTML=contentHtml(value);last.current=value;selection.current=null;}},[value]);
 function remember(){const s=window.getSelection();if(s?.rangeCount&&root.current?.contains(s.anchorNode)&&root.current.contains(s.focusNode)){selection.current=s.getRangeAt(0).cloneRange();setActive({bold:document.queryCommandState('bold'),italic:document.queryCommandState('italic'),heading:!!s.anchorNode?.parentElement?.closest('h2'),list:document.queryCommandState('insertUnorderedList')});}}
 useEffect(()=>{document.addEventListener('selectionchange',remember);return ()=>document.removeEventListener('selectionchange',remember);},[]);
 useEffect(()=>{if(!picker&&!link)return;function outside(e:PointerEvent){if(!popover.current?.contains(e.target as Node)&&!emojiButton.current?.contains(e.target as Node)){setPicker(false);setLink(false);}}function keydown(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setPicker(false);setLink(false);restore();}}document.addEventListener('pointerdown',outside);document.addEventListener('keydown',keydown,true);return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keydown,true);};},[picker,link]);
 function restore(){const node=root.current;if(!node)return;node.focus();const s=window.getSelection();s?.removeAllRanges();if(selection.current&&node.contains(selection.current.commonAncestorContainer))s?.addRange(selection.current);else{const range=document.createRange();range.selectNodeContents(node);range.collapse(false);s?.addRange(range);}}
 function sync(){if(!root.current)return;const next=markdown(root.current);if(next.length>12000){root.current.innerHTML=contentHtml(last.current||'');selection.current=null;return;}last.current=next;onChange(next);remember();}
 function command(name:string,arg?:string){if(disabled)return;restore();if(name==='insertUnorderedList')document.execCommand('formatBlock',false,'div');document.execCommand(name,false,arg);sync();}
 function close(){setPicker(false);setLink(false);restore();}
 return <><div className="content-format-toolbar rich-toolbar" role="toolbar" aria-label="ابزارهای متن">
  {([{label:'متن برجسته',icon:Bold,pressed:active.bold,action:()=>command('bold')},{label:'متن مورب',icon:Italic,pressed:active.italic,action:()=>command('italic')},{label:'افزودن عنوان',icon:Heading2,pressed:active.heading,action:()=>command('formatBlock',active.heading?'div':'h2')},{label:'افزودن فهرست',icon:List,pressed:active.list,action:()=>command('insertUnorderedList')}] as const).map(({label,icon:Icon,pressed,action})=><button type="button" title={label} aria-label={label} aria-pressed={pressed} key={label} disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={action}><Icon size={16}/></button>)}
  <button type="button" title="افزودن پیوند" aria-label="افزودن پیوند" disabled={disabled} aria-expanded={link} onMouseDown={e=>e.preventDefault()} onClick={()=>{remember();setLink(!link);setPicker(false);setUrl('');setLinkError('');}}><Link2 size={16}/></button>
  <button type="button" ref={emojiButton} title="انتخاب ایموجی" aria-label="انتخاب ایموجی" disabled={disabled} aria-expanded={picker} onMouseDown={e=>e.preventDefault()} onClick={()=>{remember();setPicker(!picker);setLink(false);}}><Smile size={16}/></button>
  <span>ویرایش متن</span>
 </div>
 {(picker||link)&&<div className="rich-editor-popover" ref={popover} role="dialog" aria-label={picker?'انتخاب ایموجی':'افزودن پیوند'} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close();}}}><div className="rich-popover-heading"><strong>{picker?'انتخاب ایموجی':'افزودن پیوند'}</strong><button type="button" aria-label="بستن پنل" onClick={close}><X size={16}/></button></div>{picker?emojis.map(group=><section key={group.title}><h4>{group.title}</h4><div className="emoji-grid">{group.items.map(emoji=><button type="button" key={emoji} aria-label={'درج '+emoji} onMouseDown={e=>e.preventDefault()} onClick={()=>{command('insertText',emoji);setPicker(false);}}>{emoji}</button>)}</div></section>):<><label className="field">نشانی پیوند<input autoFocus dir="ltr" type="url" placeholder="https://example.com" value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}/></label>{linkError&&<p className="error" role="alert">{linkError}</p>}<button type="button" className="primary" onClick={()=>{if(!/^https?:\/\/[^\s]+$/i.test(url.trim())){setLinkError('نشانی معتبر با https:// وارد کن.');return;}restore();if(!window.getSelection()?.toString())command('insertHTML','<a href="'+escape(url.trim())+'">'+escape(url.trim())+'</a>');else command('createLink',url.trim());setLink(false);}}>ثبت پیوند</button><button type="button" className="text-button" onClick={()=>{command('unlink');setLink(false);}}>حذف پیوند</button></>}</div>}
 <div ref={root} className="rich-content-input" role="textbox" aria-label="متن قابل ویرایش" aria-multiline="true" aria-disabled={disabled} contentEditable={!disabled} suppressContentEditableWarning dir="rtl" data-empty={!value} data-placeholder="محتوای پیشنهادی اینجا نمایش داده می‌شود؛ می‌توانی خودت هم بنویسی…" onInput={sync} onBlur={remember} onKeyUp={remember} onMouseUp={remember} onDrop={e=>{e.preventDefault();command('insertText',e.dataTransfer.getData('text/plain'));}} onPaste={e=>{e.preventDefault();const plain=e.clipboardData.getData('text/plain');command('insertText',plain);}}/>
 </>;
}
